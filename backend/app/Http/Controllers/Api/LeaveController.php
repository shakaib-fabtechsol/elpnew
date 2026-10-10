<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeaveResource;
use App\Models\Employee;
use App\Models\Leave;
use App\Services\LeaveBalance;
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
 * Leave: Submit Request -> Relevant Department Approval -> Management Approval.
 *
 * - Dates in order, no overlap with leave already asked for or granted.
 * - A counted type (Annual 30, Marriage 3...) cannot ask for more than is left.
 * - Days against next year's annual leave only once this year's are gone.
 * - Refusing at either stage needs a comment.
 */
class LeaveController extends Controller
{
    public function __construct(private RequestWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Leave::query()->visibleTo($request->user())->with(['employee', 'replacement', 'departmentReviewer', 'decider'])
            ->when($request->integer('employeeId'), fn (Builder $q, $id) => $q->where('employee_id', $id))
            ->when($request->integer('year'), fn (Builder $q, $y) => $q->where('year', $y))
            ->when($request->string('status')->toString(), fn (Builder $q, $s) => $q->whereIn('status', explode(',', $s)))
            ->when($request->string('search')->toString(), fn (Builder $q, $t) => $q->where(fn ($w) => $w->where('leave_no', 'like', "%$t%")->orWhere('type', 'like', "%$t%")->orWhere('reason', 'like', "%$t%")))
            ->orderByDesc('starts_on')->orderByDesc('id');

        return LeaveResource::collection($query->paginate(min($request->integer('perPage', 10), 100)));
    }

    public function show(Request $request, int $id): LeaveResource
    {
        return new LeaveResource($this->find($request, $id)->load(['employee', 'replacement', 'departmentReviewer', 'decider']));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $employee = $request->integer('employeeId') && $user->can('manage')
            ? Employee::findOrFail($request->integer('employeeId'))
            : ($user->employee ?? throw ValidationException::withMessages(['employeeId' => 'Your account is not linked to an employee record.']));

        $data = $this->validated($request, $employee, null);
        $leave = DB::transaction(function () use ($data, $employee, $user) {
            $leave = Leave::create([...$data, 'employee_id' => $employee->id, 'status' => 'Pending', 'stage' => 'department']);
            $this->workflow->log($leave, 'Leave requested', null, 'Pending', $user, null, $leave->reason);

            return $leave;
        });

        return (new LeaveResource($leave->load(['employee', 'replacement', 'departmentReviewer', 'decider'])))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $id): LeaveResource
    {
        $leave = $this->find($request, $id);
        abort_unless($request->user()->can('manage') || $request->user()->employee_id === $leave->employee_id, 403);
        if ($leave->status !== 'Pending' || $leave->stage !== 'department') {
            throw ValidationException::withMessages(['status' => 'Leave can only be changed before the department has reviewed it.']);
        }

        $leave->update($this->validated($request, $leave->employee, $leave));

        return new LeaveResource($leave->refresh()->load(['employee', 'replacement', 'departmentReviewer', 'decider']));
    }

    /** Withdrawn while still pending. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $leave = $this->find($request, $id);
        abort_unless($request->user()->can('manage') || $request->user()->employee_id === $leave->employee_id, 403);
        if ($leave->status !== 'Pending') {
            throw ValidationException::withMessages(['status' => 'A decided leave cannot be withdrawn.']);
        }
        $leave->delete();

        return response()->json(null, 204);
    }

    /** Stage 2: the relevant department approves (passes it on) or refuses it. */
    public function departmentDecision(Request $request, int $id): LeaveResource
    {
        Gate::authorize('manage');
        $leave = $this->find($request, $id);
        $data = $this->decisionInput($request);

        if ($leave->status !== 'Pending' || $leave->stage !== 'department') {
            throw ValidationException::withMessages(['decision' => 'This leave is not waiting on the department.']);
        }

        DB::transaction(function () use ($leave, $data, $request) {
            $approve = $data['decision'] === 'approve';
            $leave->update([
                'department_decision' => $data['decision'],
                'department_comment' => $data['comment'] ?? null,
                'department_by' => $request->user()->id,
                'department_at' => now(),
                'stage' => $approve ? 'management' : 'department',
                'status' => $approve ? 'Pending' : 'Rejected',
                ...($approve ? [] : ['decided_by' => $request->user()->id, 'decided_at' => now(), 'comments' => $data['comment']]),
            ]);
            $this->workflow->log($leave, $approve ? 'Approved by department' : 'Rejected by department', 'Pending', $leave->status, $request->user(), null, $data['comment'] ?? null);
        });

        return new LeaveResource($leave->refresh()->load(['employee', 'replacement', 'departmentReviewer', 'decider']));
    }

    /** Stage 3: management's final decision. The balance is checked again here. */
    public function managementDecision(Request $request, int $id): LeaveResource
    {
        Gate::authorize('manage');
        $leave = $this->find($request, $id);
        $data = $this->decisionInput($request);

        if ($leave->status !== 'Pending' || $leave->stage !== 'management') {
            throw ValidationException::withMessages(['decision' => 'This leave is not waiting on management.']);
        }

        if ($data['decision'] === 'approve') {
            $this->ensureBalance($leave->employee, $leave->type, $leave->year, $leave->countedDays(), $leave->id);
        }

        DB::transaction(function () use ($leave, $data, $request) {
            $leave->update([
                'status' => $data['decision'] === 'approve' ? 'Approved' : 'Rejected',
                'comments' => $data['comment'] ?? null,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);
            $this->workflow->log($leave, $data['decision'] === 'approve' ? 'Approved by management' : 'Rejected by management', 'Pending', $leave->status, $request->user(), null, $data['comment'] ?? null);
        });

        return new LeaveResource($leave->refresh()->load(['employee', 'replacement', 'departmentReviewer', 'decider']));
    }

    /** GET /employees/{employee}/leave-balance?type=Annual Leave&year=2026 */
    public function balance(Request $request, Employee $employee): JsonResponse
    {
        Gate::authorize('view-employee', $employee);
        $year = $request->integer('year', (int) now()->format('Y'));

        $types = $request->filled('type')
            ? [$request->string('type')->toString()]
            : array_merge(...array_map('array_keys', array_values(Leave::TYPES)));

        $balances = [];
        foreach ($types as $type) {
            $balances[] = [
                'type' => $type,
                'category' => Leave::categoryOf($type),
                'entitlement' => Leave::entitlementOf($type),
                'balance' => LeaveBalance::for($employee->id, $type, $year),
            ];
        }

        return response()->json(['data' => [
            'year' => $year,
            'canTakeAdvance' => LeaveBalance::canTakeAdvance($employee->id, $year),
            'onLeaveToday' => LeaveBalance::onLeaveToday($employee->id),
            'types' => $balances,
        ]]);
    }

    /* ------------------------------------------------------------ rules */

    private function validated(Request $request, Employee $employee, ?Leave $existing): array
    {
        $types = array_merge(...array_map('array_keys', array_values(Leave::TYPES)));

        $data = $request->validate([
            'type' => ['required', Rule::in($types)],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            // Charged to next year only for advance annual leave.
            'year' => ['nullable', 'integer'],
            'reason' => ['required', 'string', 'max:500'],
            'replacementEmployeeId' => ['nullable', 'integer', 'exists:employees,id', Rule::notIn([$employee->id])],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ], [
            'to.after_or_equal' => 'The leave cannot end before it starts.',
            'replacementEmployeeId.not_in' => 'An employee cannot replace themselves.',
        ]);

        $startYear = (int) substr($data['from'], 0, 4);
        $year = (int) ($data['year'] ?? $startYear);

        if ($year !== $startYear) {
            if ($data['type'] !== 'Annual Leave' || $year !== $startYear + 1) {
                throw ValidationException::withMessages(['year' => 'Only annual leave can be charged to next year.']);
            }
            if (! LeaveBalance::canTakeAdvance($employee->id, $startYear)) {
                throw ValidationException::withMessages(['year' => 'Advance leave is possible only once this year\'s annual leave is used up.']);
            }
        }

        $overlap = Leave::where('employee_id', $employee->id)
            ->whereIn('status', ['Pending', 'Approved'])
            ->when($existing, fn ($q) => $q->whereKeyNot($existing->id))
            ->whereDate('starts_on', '<=', $data['to'])
            ->whereDate('ends_on', '>=', $data['from'])
            ->first();
        if ($overlap) {
            throw ValidationException::withMessages(['from' => 'These dates overlap leave '.$overlap->leave_no.' already asked for.']);
        }

        $days = Leave::daysBetween($data['from'], $data['to']);
        $this->ensureBalance($employee, $data['type'], $year, $days, $existing?->id);

        $attachment = $request->file('attachment')?->store('leaves/'.$employee->id, 'local');

        return [
            'category' => Leave::categoryOf($data['type']),
            'type' => $data['type'],
            'starts_on' => $data['from'],
            'ends_on' => $data['to'],
            'year' => $year,
            'reason' => $data['reason'],
            'replacement_employee_id' => $data['replacementEmployeeId'] ?? null,
            ...($attachment ? ['attachment' => $attachment] : []),
        ];
    }

    private function ensureBalance(Employee $employee, string $type, int $year, float $days, ?int $exceptId): void
    {
        $balance = LeaveBalance::for($employee->id, $type, $year, $exceptId);
        if ($balance !== null && $days > $balance['remaining']) {
            throw ValidationException::withMessages([
                'to' => $days.' days asked for, but only '.$balance['remaining'].' days of '.$type.' are left in '.$year.'.',
            ]);
        }
    }

    private function decisionInput(Request $request): array
    {
        return $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'comment' => ['nullable', 'string', 'max:300', 'required_if:decision,reject'],
        ], ['comment.required_if' => 'Give the reason for rejecting the leave.']);
    }

    private function find(Request $request, int $id): Leave
    {
        return Leave::query()->visibleTo($request->user())->findOrFail($id);
    }
}
