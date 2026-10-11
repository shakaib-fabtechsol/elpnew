<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\EmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EntitlementRequest;
use App\Models\GeneralRequest;
use App\Models\Leave;
use App\Models\Loan;
use App\Models\SalaryAdvance;
use App\Services\Eligibility;
use App\Services\Permissions\Access;
use App\Support\ShortName;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class EmployeeController extends Controller
{
    /** GET /employees?search=&status=&department=&branch=&perPage= */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = Employee::query()
            ->tap(fn (Builder $q) => Access::restrict($q, $user, 'id'))
            ->search($request->string('search')->toString() ?: null)
            ->when($request->string('status')->toString(), fn (Builder $q, $v) => $q->where('status', $v))
            ->when($request->string('department')->toString(), fn (Builder $q, $v) => $q->where('department', $v))
            ->when($request->string('branch')->toString(), fn (Builder $q, $v) => $q->where('branch', $v))
            ->orderBy('emp_no');

        return EmployeeResource::collection($query->paginate(min($request->integer('perPage', 25), 200)));
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        Gate::authorize('permission', 'employees.create');
        $employee = Employee::create($request->columns());

        return (new EmployeeResource($employee->refresh()))->response()->setStatusCode(201);
    }

    public function show(Employee $employee): EmployeeResource
    {
        Gate::authorize('view-employee', $employee);

        return new EmployeeResource($employee->load('user'));
    }

    public function update(EmployeeRequest $request, Employee $employee): EmployeeResource
    {
        Gate::authorize('permission', 'employees.edit');
        // And only a record their access reaches.
        Gate::authorize('view-employee', $employee);
        $employee->update($request->columns());

        return new EmployeeResource($employee->refresh());
    }

    /** Archived, never erased: requests and payments still point at the record. */
    public function destroy(Employee $employee): JsonResponse
    {
        Gate::authorize('permission', 'employees.delete');
        Gate::authorize('view-employee', $employee);
        $employee->delete();

        return response()->json(null, 204);
    }

    /** GET /employees/next-number - what the Add Employee header shows. */
    public function nextNumber(): JsonResponse
    {
        Gate::authorize('permission', 'employees.create');
        $value = (int) DB::table('sequences')->where('series', 'EMP')->value('value');

        return response()->json(['data' => ['empNo' => 'EMP-'.str_pad((string) ($value + 1), 4, '0', STR_PAD_LEFT)]]);
    }

    /**
     * GET /employees/short-name?name=&nameAr=&except=
     *
     * The short name a full name would be given - first and family name, or
     * longer where somebody else already goes by that - for the form to
     * show beside the full name while it is being typed.
     */
    public function shortName(Request $request): JsonResponse
    {
        abort_unless(Access::allows($request->user(), 'employees.create', 'employees.edit'), 403);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'nameAr' => ['nullable', 'string', 'max:255'],
            'except' => ['nullable', 'integer'],
        ]);
        $except = $data['except'] ?? null;
        $plain = ShortName::from($data['name'] ?? null);
        $shortName = ShortName::unique($data['name'] ?? null, 'short_name', $except);
        $sharedWith = $plain && $plain !== $shortName ? ShortName::heldBy($plain, 'short_name', $except) : null;

        return response()->json(['data' => [
            'shortName' => $shortName,
            'shortNameAr' => ShortName::unique($data['nameAr'] ?? null, 'short_name_ar', $except),
            // Who holds the plainer form, when a middle name had to be added.
            'sharedWith' => $sharedWith ? ['id' => $sharedWith->id, 'empNo' => $sharedWith->emp_no, 'name' => $sharedWith->name, 'shortName' => $sharedWith->short_name] : null,
        ]]);
    }

    /**
     * GET /employees/{employee}/requests-overview
     *
     * Every request type's counts by status - the figures on the Requests
     * page cards (Approved / Pending / Returned / Rejected) - plus what the
     * employee may still ask for.
     */
    public function requestsOverview(Employee $employee): JsonResponse
    {
        Gate::authorize('view-employee', $employee);

        $count = function (Builder $query): array {
            $byStatus = $query->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
            $n = fn (string ...$statuses) => (int) collect($statuses)->sum(fn ($s) => $byStatus[$s] ?? 0);

            return [
                'total' => (int) $byStatus->sum(),
                'approved' => $n(RequestStatus::Approved->value, RequestStatus::Paid->value),
                'pending' => $n(RequestStatus::Pending->value),
                'returned' => $n(RequestStatus::Returned->value),
                'rejected' => $n(RequestStatus::Rejected->value),
            ];
        };

        $mine = fn (string $model) => $model::query()->where('employee_id', $employee->id);
        $entitlements = fn (string $kind) => $count($mine(EntitlementRequest::class)->where('kind', $kind));

        $leaves = $mine(Leave::class)->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return response()->json(['data' => [
            'financing' => [
                'salaryAdvance' => $count($mine(SalaryAdvance::class)),
                'loan' => $count($mine(Loan::class)),
                'assistance' => $count($mine(AssistanceRequest::class)),
            ],
            'entitlements' => [
                'bonus' => $count($mine(Bonus::class)),
                'commission' => $count($mine(Commission::class)),
                'overtime' => $entitlements('overtime'),
                'leaveEncashment' => $entitlements('leaveEncashment'),
            ],
            'allowances' => [
                'medical' => $entitlements('medical'),
                'transport' => $entitlements('transport'),
                'travel' => $entitlements('travel'),
                'airTicket' => $entitlements('airTicket'),
            ],
            'endOfService' => [
                'notice' => $entitlements('notice'),
                'endOfService' => $entitlements('endOfService'),
            ],
            'administrative' => [
                'leave' => [
                    'total' => (int) $leaves->sum(),
                    'approved' => (int) (($leaves['Approved'] ?? 0) + ($leaves[Leave::ENCASHED_PAID] ?? 0)),
                    'pending' => (int) ($leaves['Pending'] ?? 0),
                    'returned' => 0,
                    'rejected' => (int) ($leaves['Rejected'] ?? 0),
                ],
                'general' => $this->generalCounts($employee, 'general'),
                'grievance' => $this->generalCounts($employee, 'grievance'),
                'complaint' => $this->generalCounts($employee, 'complaint'),
            ],
            'eligibility' => [
                'salaryAdvance' => Eligibility::advanceSummary($employee),
                'loan' => Eligibility::loanSummary($employee),
                'assistance' => Eligibility::assistanceSummary($employee),
            ],
        ]]);
    }

    private function generalCounts(Employee $employee, string $kind): array
    {
        $by = GeneralRequest::where('employee_id', $employee->id)->where('kind', $kind)
            ->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return [
            'total' => (int) $by->sum(),
            'approved' => (int) ($by['Approved'] ?? 0),
            'pending' => (int) ($by['Pending'] ?? 0),
            'returned' => 0,
            'rejected' => (int) ($by['Rejected'] ?? 0),
        ];
    }
}
