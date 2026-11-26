<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OffboardingResource;
use App\Models\Employee;
use App\Models\Offboarding;
use App\Models\OffboardingTask;
use App\Services\Offboarding\Clearance;
use App\Services\Permissions\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Employee Offboarding - End of Service, as its own process.
 *
 *   GET    offboardings                       the cases the viewer may see
 *   POST   offboardings                       start one (management; or an employee's own resignation)
 *   GET    offboardings/{case}                one case: checklist, assets, settlement, blockers
 *   PATCH  offboardings/{case}                correct the notice and dates while it is open
 *   POST   offboardings/{case}/decision       approve or reject
 *   PATCH  offboardings/{case}/tasks/{task}   tick, set aside or reopen a checklist item
 *   PUT    offboardings/{case}/interview      the exit interview (optional)
 *   POST   offboardings/{case}/complete       close it: Inactive, access revoked
 *   POST   offboardings/{case}/cancel         withdraw it before it closes
 *
 * Permissions: offboarding.view / create / edit / approve, within the
 * viewer's record access. An employee always sees their own case, and may
 * file their own resignation without any of them.
 */
class OffboardingController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $query = Offboarding::with(['employee:id,emp_no,name,short_name,department,occupation,status', 'tasks', 'initiator:id,name'])
            ->orderByRaw('case status when ? then 0 when ? then 1 else 2 end', [Offboarding::PENDING, Offboarding::IN_PROGRESS])
            ->orderByDesc('id');

        if (Gate::allows('permission', 'offboarding.view')) {
            Access::restrict($query, $user);
        } else {
            $query->where('employee_id', $user->employee_id ?? 0);
        }

        if ($request->filled('employeeId')) {
            $query->where('employee_id', (int) $request->input('employeeId'));
        }

        return OffboardingResource::collection($query->get());
    }

    public function show(Request $request, Offboarding $offboarding): OffboardingResource
    {
        $this->mayView($request, $offboarding);

        return $this->detail($offboarding);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'employeeId' => ['required', 'integer', Rule::exists('employees', 'id')->whereNull('deleted_at')],
            'type' => ['required', Rule::in(Offboarding::TYPES)],
            'reason' => ['nullable', 'string', 'max:80'],
            'details' => ['nullable', 'string', 'max:2000'],
            'noticeDate' => ['required', 'date_format:Y-m-d'],
            'noticeDays' => ['required', 'integer', 'between:0,180'],
            'noticeMode' => ['required', Rule::in(Offboarding::NOTICE_MODES)],
            'lastWorkingDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:noticeDate'],
        ], ['lastWorkingDate.after_or_equal' => 'The last working day cannot be before the notice date.']);

        $employee = Employee::findOrFail($data['employeeId']);
        $own = $user->employee_id === $employee->id;
        if ($own) {
            // Anybody may resign; nobody terminates themselves.
            abort_unless($data['type'] === 'Resignation', 403, 'Only a resignation can be filed on your own record.');
        } else {
            Gate::authorize('permission', 'offboarding.create');
            Gate::authorize('view-employee', $employee);
        }

        if ($employee->status === 'Inactive') {
            throw ValidationException::withMessages(['employeeId' => 'This employee has already left.']);
        }
        if (Offboarding::where('employee_id', $employee->id)->open()->exists()) {
            throw ValidationException::withMessages(['employeeId' => 'This employee already has an offboarding case in progress.']);
        }

        $case = DB::transaction(function () use ($data, $employee, $user) {
            $case = Offboarding::create([
                'employee_id' => $employee->id,
                'type' => $data['type'],
                'reason' => $data['reason'] ?? null,
                'details' => $data['details'] ?? null,
                'notice_date' => $data['noticeDate'],
                'notice_days' => $data['noticeDays'],
                'notice_mode' => $data['noticeMode'],
                'last_working_date' => $data['lastWorkingDate'],
                'status' => Offboarding::PENDING,
                'initiated_by' => $user->id,
            ]);
            Clearance::seed($case);

            return $case;
        });

        return $this->detail($case)->response()->setStatusCode(201);
    }

    public function update(Request $request, Offboarding $offboarding): OffboardingResource
    {
        $this->mayEdit($request, $offboarding);
        $data = $request->validate([
            'reason' => ['sometimes', 'nullable', 'string', 'max:80'],
            'details' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'noticeDate' => ['sometimes', 'date_format:Y-m-d'],
            'noticeDays' => ['sometimes', 'integer', 'between:0,180'],
            'noticeMode' => ['sometimes', Rule::in(Offboarding::NOTICE_MODES)],
            'lastWorkingDate' => ['sometimes', 'date_format:Y-m-d'],
        ]);

        $offboarding->fill([
            'reason' => array_key_exists('reason', $data) ? $data['reason'] : $offboarding->reason,
            'details' => array_key_exists('details', $data) ? $data['details'] : $offboarding->details,
            'notice_date' => $data['noticeDate'] ?? $offboarding->notice_date->format('Y-m-d'),
            'notice_days' => $data['noticeDays'] ?? $offboarding->notice_days,
            'notice_mode' => $data['noticeMode'] ?? $offboarding->notice_mode,
            'last_working_date' => $data['lastWorkingDate'] ?? $offboarding->last_working_date->format('Y-m-d'),
        ]);
        if ($offboarding->last_working_date->lt($offboarding->notice_date)) {
            throw ValidationException::withMessages(['lastWorkingDate' => 'The last working day cannot be before the notice date.']);
        }
        $offboarding->save();

        return $this->detail($offboarding);
    }

    public function decide(Request $request, Offboarding $offboarding): OffboardingResource
    {
        Gate::authorize('permission', 'offboarding.approve');
        $this->mayView($request, $offboarding);
        abort_if($request->user()->employee_id === $offboarding->employee_id, 403, 'Nobody approves their own offboarding.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'comment' => ['nullable', 'string', 'max:1000', 'required_if:decision,reject'],
        ], ['comment.required_if' => 'Say why the case is rejected.']);

        if ($offboarding->status !== Offboarding::PENDING) {
            throw ValidationException::withMessages(['decision' => 'This case has already been decided.']);
        }

        $offboarding->forceFill([
            'status' => $data['decision'] === 'approve' ? Offboarding::IN_PROGRESS : Offboarding::REJECTED,
            'decided_by' => $request->user()->id,
            'decided_at' => now(),
            'decision_comment' => $data['comment'] ?? null,
        ])->save();

        return $this->detail($offboarding);
    }

    public function updateTask(Request $request, Offboarding $offboarding, OffboardingTask $task): OffboardingResource
    {
        $this->mayEdit($request, $offboarding);
        abort_unless($task->offboarding_id === $offboarding->id, 404);
        abort_unless($offboarding->status === Offboarding::IN_PROGRESS, 422, 'The checklist is worked through once the case is approved.');
        $data = $request->validate([
            'status' => ['required', Rule::in(OffboardingTask::STATUSES)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        // Setting an item aside is a decision, so it is said why.
        if ($data['status'] === OffboardingTask::NOT_APPLICABLE && blank($data['notes'] ?? $task->notes)) {
            throw ValidationException::withMessages(['notes' => 'Say why this item does not apply.']);
        }

        $task->fill([
            'status' => $data['status'],
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $task->notes,
            'completed_by' => $data['status'] === OffboardingTask::PENDING ? null : $request->user()->id,
            'completed_at' => $data['status'] === OffboardingTask::PENDING ? null : now(),
        ])->save();

        return $this->detail($offboarding);
    }

    public function interview(Request $request, Offboarding $offboarding): OffboardingResource
    {
        $this->mayEdit($request, $offboarding);
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'primaryReason' => ['required', 'string', 'max:80'],
            'satisfaction' => ['required', 'integer', 'between:1,5'],
            'wouldRecommend' => ['required', 'boolean'],
            'eligibleForRehire' => ['required', 'boolean'],
            'comments' => ['nullable', 'string', 'max:2000'],
        ]);

        $offboarding->forceFill(['exit_interview' => [...$data, 'conductedBy' => $request->user()->name]])->save();

        return $this->detail($offboarding);
    }

    public function complete(Request $request, Offboarding $offboarding): OffboardingResource
    {
        Gate::authorize('permission', 'offboarding.approve');
        $this->mayView($request, $offboarding);
        abort_if($request->user()->employee_id === $offboarding->employee_id, 403, 'Nobody completes their own offboarding.');

        Clearance::complete($offboarding->load('employee', 'tasks'), $request->user());

        return $this->detail($offboarding->refresh());
    }

    public function cancel(Request $request, Offboarding $offboarding): OffboardingResource
    {
        $own = $request->user()->employee_id === $offboarding->employee_id;
        // An employee may withdraw their own resignation while it waits.
        if (! ($own && $offboarding->status === Offboarding::PENDING)) {
            $this->mayEdit($request, $offboarding);
        }
        if (! $offboarding->isOpen()) {
            throw ValidationException::withMessages(['case' => 'Only a case in progress can be cancelled.']);
        }
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']], ['comment.required' => 'Say why the case is cancelled.']);

        $offboarding->forceFill(['status' => Offboarding::CANCELLED, 'decision_comment' => $data['comment']])->save();

        return $this->detail($offboarding);
    }

    /* ---------------------------------------------------------- helpers */

    private function detail(Offboarding $case): OffboardingResource
    {
        $case->load(['employee', 'tasks.completer:id,name', 'initiator:id,name', 'decider:id,name', 'completer:id,name']);

        return (new OffboardingResource($case))->detailed();
    }

    private function mayView(Request $request, Offboarding $case): void
    {
        $user = $request->user();
        if ($user->employee_id === $case->employee_id) {
            return;
        }
        Gate::authorize('permission', 'offboarding.view');
        Gate::authorize('view-employee', $case->employee);
    }

    private function mayEdit(Request $request, Offboarding $case): void
    {
        Gate::authorize('permission', 'offboarding.edit');
        Gate::authorize('view-employee', $case->employee);
        abort_if($request->user()->employee_id === $case->employee_id, 403, 'Your own offboarding is handled by somebody else.');
        abort_unless($case->isOpen(), 422, 'This case is closed.');
    }
}
