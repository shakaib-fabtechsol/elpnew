<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ViolationResource;
use App\Models\Employee;
use App\Models\Violation;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Violations, stage by stage, each filling its own part of one record:
 *
 *   POST /violations                       1. Add Violation          (management)
 *   POST /violations/{id}/acknowledge         "Yes, I Have Read It"  (employee)
 *   POST /violations/{id}/response         2. Employee Response      (employee)
 *   POST /violations/{id}/decision         3. Decision / penalty     (management) -> numbered VIO-004
 *   POST /violations/{id}/appeal           4. Appeal                 (employee)
 *   POST /violations/{id}/outcome          5. Appeal Outcome         (management)
 */
class ViolationController extends Controller
{
    public function __construct(private RequestWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Violation::query()->visibleTo($request->user())->with(['employee', 'approver', 'outcomeApprover'])
            ->when($request->integer('employeeId'), fn (Builder $q, $id) => $q->where('employee_id', $id))
            ->when($request->string('status')->toString(), fn (Builder $q, $s) => $q->whereIn('status', explode(',', $s)))
            ->orderByDesc('date')->orderByDesc('id');

        return ViolationResource::collection($query->paginate(min($request->integer('perPage', 10), 100)));
    }

    public function show(Request $request, int $id): ViolationResource
    {
        return new ViolationResource($this->find($request, $id)->load(['employee', 'approver', 'outcomeApprover']));
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage');
        $data = $request->validate([
            'employeeId' => ['required', 'integer', 'exists:employees,id'],
            'type' => ['required', Rule::in(Violation::TYPES)],
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'description' => ['required', 'string', 'max:1000'],
            'investigationStart' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date'],
            'investigator' => ['nullable', 'string', 'max:255'],
            'document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $violation = DB::transaction(function () use ($data, $request) {
            $violation = Violation::create([
                'employee_id' => $data['employeeId'],
                'type' => $data['type'],
                'date' => $data['date'],
                'description' => $data['description'],
                'investigation_start' => $data['investigationStart'] ?? $data['date'],
                'investigator' => $data['investigator'] ?? $request->user()->name,
                'document' => $request->file('document')?->store('violations/'.$data['employeeId'], 'local'),
                'status' => 'Under Investigation',
            ]);
            $this->workflow->log($violation, 'Violation recorded', null, 'Under Investigation', $request->user(), null, $data['description']);

            return $violation;
        });

        return (new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover'])))->response()->setStatusCode(201);
    }

    /** The employee confirms they have read the violation. */
    public function acknowledge(Request $request, int $id): ViolationResource
    {
        $violation = $this->ownedBy($request, $id);
        if (! $violation->acknowledged_at) {
            $violation->update(['acknowledged_at' => now()]);
            $this->workflow->log($violation, 'Read by employee', null, null, $request->user());
        }

        return new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover']));
    }

    public function respond(Request $request, int $id): ViolationResource
    {
        $violation = $this->ownedBy($request, $id);
        $this->expectStage($violation, 'response');

        $data = $request->validate([
            'response' => ['required', 'string', 'max:1000'],
            'responseDocument' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $violation->update([
            'response' => $data['response'],
            'response_document' => $request->file('responseDocument')?->store('violations/'.$violation->employee_id, 'local'),
            'acknowledged_at' => $violation->acknowledged_at ?? now(),
        ]);
        $this->workflow->log($violation, 'Employee responded', null, null, $request->user(), null, $data['response']);

        return new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover']));
    }

    public function decide(Request $request, int $id): ViolationResource
    {
        Gate::authorize('manage');
        $violation = $this->find($request, $id);
        if ($violation->penalty_type) {
            throw ValidationException::withMessages(['penaltyType' => 'A penalty has already been decided.']);
        }

        $data = $request->validate([
            'investigationResult' => ['required', Rule::in(Violation::INVESTIGATION_RESULTS)],
            'penaltyType' => ['required', Rule::in(Violation::PENALTIES)],
            'deductionAmount' => ['nullable', 'numeric', 'gt:0', 'required_if:penaltyType,'.Violation::DEDUCTION_PENALTY],
            'decisionReasons' => ['required', 'string', 'max:1000'],
            'penaltyDate' => ['required', 'date_format:Y-m-d'],
            'decisionDocument' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        if ($data['investigationResult'] === 'Not Guilty' && $data['penaltyType'] !== Violation::NO_PENALTY) {
            throw ValidationException::withMessages(['penaltyType' => 'An employee found not guilty receives no penalty.']);
        }

        DB::transaction(function () use ($violation, $data, $request) {
            $issued = $data['penaltyType'] !== Violation::NO_PENALTY;
            $violation->fill([
                'investigation_result' => $data['investigationResult'],
                'penalty_type' => $data['penaltyType'],
                'deduction_amount' => $data['penaltyType'] === Violation::DEDUCTION_PENALTY ? $data['deductionAmount'] : null,
                'decision_reasons' => $data['decisionReasons'],
                'penalty_date' => $data['penaltyDate'],
                'decision_document' => $request->file('decisionDocument')?->store('violations/'.$violation->employee_id, 'local'),
                'approved_by' => $request->user()->id,
                'status' => $issued ? 'Penalty Issued' : 'Closed',
            ]);
            if ($issued) {
                $violation->assignNumber();
            }
            $violation->save();
            $this->workflow->log($violation, 'Penalty decided: '.$data['penaltyType'], 'Under Investigation', $violation->status, $request->user(), $violation->deduction_amount, $data['decisionReasons'], $violation->violation_no);
        });

        return new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover']));
    }

    public function appeal(Request $request, int $id): ViolationResource
    {
        $violation = $this->ownedBy($request, $id);
        if ($violation->status !== 'Penalty Issued') {
            throw ValidationException::withMessages(['appealGrounds' => 'Only an issued penalty can be appealed.']);
        }

        $data = $request->validate([
            'appealGrounds' => ['required', 'string', 'max:1000'],
            'appealDocument' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $violation->update([
            'appeal_date' => now()->format('Y-m-d'),
            'appeal_grounds' => $data['appealGrounds'],
            'appeal_document' => $request->file('appealDocument')?->store('violations/'.$violation->employee_id, 'local'),
            'status' => 'Under Appeal',
        ]);
        $this->workflow->log($violation, 'Appeal filed', 'Penalty Issued', 'Under Appeal', $request->user(), null, $data['appealGrounds']);

        return new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover']));
    }

    public function outcome(Request $request, int $id): ViolationResource
    {
        Gate::authorize('manage');
        $violation = $this->find($request, $id);
        if ($violation->status !== 'Under Appeal') {
            throw ValidationException::withMessages(['appealOutcome' => 'There is no appeal waiting on this violation.']);
        }

        $partial = $request->input('appealOutcome') === Violation::PARTIAL_OUTCOME;
        $data = $request->validate([
            'appealOutcome' => ['required', Rule::in(Violation::APPEAL_OUTCOMES)],
            'outcomeReasons' => ['required', 'string', 'max:1000'],
            'modifiedPenaltyType' => [Rule::requiredIf($partial), 'nullable', Rule::in(Violation::PENALTIES)],
            'modifiedDeductionAmount' => ['nullable', 'numeric', 'gt:0', 'required_if:modifiedPenaltyType,'.Violation::DEDUCTION_PENALTY],
        ]);

        $cancelled = $data['appealOutcome'] === Violation::CANCELLING_OUTCOME;
        $violation->update([
            'appeal_outcome' => $data['appealOutcome'],
            'outcome_reasons' => $data['outcomeReasons'],
            'modified_penalty_type' => $partial ? $data['modifiedPenaltyType'] : null,
            'modified_deduction_amount' => $partial ? ($data['modifiedDeductionAmount'] ?? null) : null,
            'outcome_approved_by' => $request->user()->id,
            'outcome_date' => now()->format('Y-m-d'),
            'status' => $cancelled ? 'Cancelled' : 'Closed',
        ]);
        $this->workflow->log($violation, 'Appeal settled: '.$data['appealOutcome'], 'Under Appeal', $violation->status, $request->user(), null, $data['outcomeReasons']);

        return new ViolationResource($violation->load(['employee', 'approver', 'outcomeApprover']));
    }

    /* ---------------------------------------------------------- helpers */

    private function find(Request $request, int $id): Violation
    {
        return Violation::query()->visibleTo($request->user())->findOrFail($id);
    }

    /** The employee's own stages: only they (or management) may fill them. */
    private function ownedBy(Request $request, int $id): Violation
    {
        $violation = $this->find($request, $id);
        abort_unless($request->user()->employee_id === $violation->employee_id || $request->user()->can('manage'), 403);

        return $violation;
    }

    private function expectStage(Violation $violation, string $stage): void
    {
        if ($violation->nextStage() !== $stage) {
            throw ValidationException::withMessages(['stage' => 'This violation is at the '.$violation->nextStage().' stage.']);
        }
    }
}
