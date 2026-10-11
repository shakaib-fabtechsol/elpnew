<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeePermission;
use App\Models\PermissionDelegation;
use App\Models\PermissionEvent;
use App\Models\User;
use App\Services\Permissions\Access;
use App\Services\Permissions\PermissionAdvisor;
use App\Services\Permissions\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * System Permissions: what one employee may see and do.
 *
 *   GET    /employees/{employee}/permissions                the whole page
 *   PUT    /employees/{employee}/permissions                save the settings
 *   POST   /employees/{employee}/permissions/review         the access review for an unsaved draft
 *   POST   /employees/{employee}/permissions/assist         an instruction in words -> a proposed change
 *   POST   /employees/{employee}/permissions/delegations    temporary or delegated access
 *   DELETE /employees/{employee}/permissions/delegations/{delegation}
 *
 * Nobody sets their own permissions, and every change is written to the
 * employee's permission history.
 */
class EmployeePermissionController extends Controller
{
    public function show(Employee $employee): JsonResponse
    {
        Gate::authorize('permission', 'permissions.view');

        return response()->json(['data' => $this->page($employee)]);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $state = $this->state($request);
        $before = Access::settings($employee);

        DB::transaction(function () use ($employee, $state, $before, $request) {
            EmployeePermission::updateOrCreate(['employee_id' => $employee->id], [
                'template' => $state['template'],
                'grants' => $state['grants'],
                'scope' => $state['scope'],
                'departments' => $state['scope'] === 'department' ? $state['departments'] : [],
                'approval_limit' => $state['approvalLimit'],
                'payment_limit' => $state['paymentLimit'],
                'updated_by' => $request->user()->id,
            ]);

            $changes = $this->difference($before, $state);
            if ($changes['summary']) {
                PermissionEvent::create([
                    'employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'updated',
                    'summary' => $changes['summary'], 'changes' => $changes['detail'],
                ]);
            }
        });

        return response()->json(['data' => $this->page($employee)]);
    }

    /** The access review for a draft, before it is saved. */
    public function review(Request $request, Employee $employee): JsonResponse
    {
        Gate::authorize('permission', 'permissions.view');

        return response()->json(['data' => ['risks' => PermissionCatalog::review($this->state($request))]]);
    }

    public function assist(Request $request, Employee $employee, PermissionAdvisor $advisor): JsonResponse
    {
        $this->mayChange($request, $employee);
        $request->validate(['instruction' => ['nullable', 'string', 'max:1000']]);
        $state = $this->state($request);

        $advice = $advisor->advise($employee, $state, $request->input('instruction'));

        return response()->json(['data' => [
            ...$advice,
            'grantLabels' => array_map(PermissionCatalog::label(...), $advice['grant']),
            'revokeLabels' => array_map(PermissionCatalog::label(...), $advice['revoke']),
        ]]);
    }

    public function delegate(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $data = $request->validate([
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', Rule::in(PermissionCatalog::keys())],
            'fromEmployeeId' => ['nullable', 'integer', 'exists:employees,id', Rule::notIn([$employee->id])],
            'startsOn' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'endsOn' => ['required', 'date_format:Y-m-d', 'after_or_equal:startsOn', 'before_or_equal:'.now()->addYear()->toDateString()],
            'reason' => ['required', 'string', 'max:300'],
        ], [
            'permissions.required' => 'Choose at least one permission.',
            'fromEmployeeId.not_in' => 'An employee cannot delegate to themselves.',
            'endsOn.before_or_equal' => 'Temporary access can last one year at most.',
        ]);

        $permissions = PermissionCatalog::clean($data['permissions']);
        $from = ($data['fromEmployeeId'] ?? null) ? Employee::find($data['fromEmployeeId']) : null;

        // Nobody lends what they do not hold.
        if ($from) {
            $missing = array_diff($permissions, Access::effective($from));
            if ($missing) {
                throw ValidationException::withMessages(['permissions' => [
                    $from->displayName().' does not hold: '.implode(', ', array_map(PermissionCatalog::label(...), $missing)).'.',
                ]]);
            }
        }

        DB::transaction(function () use ($employee, $from, $permissions, $data, $request) {
            PermissionDelegation::create([
                'employee_id' => $employee->id, 'from_employee_id' => $from?->id, 'permissions' => $permissions,
                'starts_on' => $data['startsOn'], 'ends_on' => $data['endsOn'], 'reason' => $data['reason'],
                'granted_by' => $request->user()->id,
            ]);
            PermissionEvent::create([
                'employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'delegated',
                'summary' => ($from ? 'Delegated from '.$from->displayName() : 'Temporary access').': '.count($permissions).' permission'.(count($permissions) === 1 ? '' : 's')
                    .' from '.$data['startsOn'].' to '.$data['endsOn'].'.',
                'changes' => ['granted' => $permissions, 'reason' => $data['reason']],
            ]);
        });

        return response()->json(['data' => $this->page($employee)], 201);
    }

    public function revoke(Request $request, Employee $employee, PermissionDelegation $delegation): JsonResponse
    {
        $this->mayChange($request, $employee);
        abort_unless($delegation->employee_id === $employee->id, 404);
        abort_if($delegation->revoked_at !== null, 422, 'This access has already been revoked.');

        DB::transaction(function () use ($delegation, $employee, $request) {
            $delegation->update(['revoked_at' => now(), 'revoked_by' => $request->user()->id]);
            PermissionEvent::create([
                'employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'revoked',
                'summary' => 'Revoked temporary access ('.count($delegation->permissions).' permission'.(count($delegation->permissions) === 1 ? '' : 's').') before its end date.',
                'changes' => ['revoked' => $delegation->permissions],
            ]);
        });

        return response()->json(['data' => $this->page($employee)]);
    }

    /**
     * POST /employees/{employee}/permissions/account
     *
     * The employee's login account. Without one the permissions set here
     * have nobody to apply to. The password is made here, shown once to
     * whoever created the account to hand over, and never stored readable.
     */
    public function createAccount(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        abort_if($employee->user()->exists(), 422, 'This employee already has a login account.');
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(Role::class)],
        ], ['email.unique' => 'Another account already signs in with this email.']);

        $password = Str::password(14, symbols: false);
        DB::transaction(function () use ($employee, $data, $password, $request) {
            User::create(['name' => $employee->name, 'email' => $data['email'], 'password' => $password, 'role' => $data['role'], 'employee_id' => $employee->id]);
            PermissionEvent::create([
                'employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'account',
                'summary' => 'Login account created ('.$data['email'].', '.Role::from($data['role'])->label().').',
            ]);
        });

        return response()->json(['data' => [...$this->page($employee->unsetRelation('user')), 'temporaryPassword' => $password]], 201);
    }

    /** PATCH - the account's role; POST .../reset - a new password, signing every device out. */
    public function updateAccount(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $user = $employee->user()->firstOrFail();
        $data = $request->validate(['role' => ['required', Rule::enum(Role::class)]]);

        if ($user->role->value !== $data['role']) {
            DB::transaction(function () use ($user, $data, $employee, $request) {
                $from = $user->role->label();
                $user->update(['role' => $data['role']]);
                PermissionEvent::create([
                    'employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'account',
                    'summary' => 'Account role changed from '.$from.' to '.Role::from($data['role'])->label().'.',
                ]);
            });
        }

        return response()->json(['data' => $this->page($employee->unsetRelation('user'))]);
    }

    public function resetPassword(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $user = $employee->user()->firstOrFail();

        $password = Str::password(14, symbols: false);
        DB::transaction(function () use ($user, $password, $employee, $request) {
            $user->update(['password' => $password]);
            $user->tokens()->delete();
            PermissionEvent::create(['employee_id' => $employee->id, 'user_id' => $request->user()->id, 'action' => 'account', 'summary' => 'Password reset; every device signed out.']);
        });

        return response()->json(['data' => [...$this->page($employee->unsetRelation('user')), 'temporaryPassword' => $password]]);
    }

    /* ---------------------------------------------------------- helpers */

    /** Changing needs the permission, and is never done on one's own record. */
    private function mayChange(Request $request, Employee $employee): void
    {
        Gate::authorize('permission', 'permissions.edit');
        abort_if($request->user()->employee_id === $employee->id, 403, 'Nobody sets their own permissions. Ask another administrator.');
    }

    /** The settings sent by the page, checked against the catalogue. */
    private function state(Request $request): array
    {
        $data = $request->validate([
            'template' => ['required', Rule::in(array_keys(PermissionCatalog::TEMPLATES))],
            'grants' => ['present', 'array'],
            'grants.*' => ['string'],
            'scope' => ['required', Rule::in(array_keys(PermissionCatalog::SCOPES))],
            'departments' => ['nullable', 'array', 'required_if:scope,department'],
            'departments.*' => [Rule::in(PermissionCatalog::departments())],
            'approvalLimit' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'paymentLimit' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
        ], ['departments.required_if' => 'Choose at least one department.']);

        return [
            'template' => $data['template'],
            'grants' => PermissionCatalog::clean($data['grants']),
            'scope' => $data['scope'],
            'departments' => array_values($data['departments'] ?? []),
            'approvalLimit' => isset($data['approvalLimit']) ? round((float) $data['approvalLimit'], 3) : null,
            'paymentLimit' => isset($data['paymentLimit']) ? round((float) $data['paymentLimit'], 3) : null,
        ];
    }

    /** What a save changed, in words and in detail. */
    private function difference(array $before, array $after): array
    {
        $granted = array_values(array_diff($after['grants'], $before['grants']));
        $revoked = array_values(array_diff($before['grants'], $after['grants']));
        $parts = [];
        $fields = [];

        if ($granted) {
            $parts[] = 'granted '.count($granted);
        }
        if ($revoked) {
            $parts[] = 'removed '.count($revoked);
        }
        if ($before['scope'] !== $after['scope'] || $before['departments'] != $after['departments']) {
            $reach = PermissionCatalog::SCOPES[$after['scope']].($after['scope'] === 'department' ? ' ('.implode(', ', $after['departments']).')' : '');
            $parts[] = 'record access set to '.$reach;
            $fields['scope'] = [PermissionCatalog::SCOPES[$before['scope']], $reach];
        }
        foreach (['approvalLimit' => 'approval limit', 'paymentLimit' => 'payment limit'] as $key => $label) {
            if ($before[$key] !== $after[$key]) {
                $show = fn ($value) => $value === null ? 'no limit' : number_format($value, 3).' OMR';
                $parts[] = $label.' '.$show($before[$key]).' → '.$show($after[$key]);
                $fields[$key] = [$before[$key], $after[$key]];
            }
        }
        if (! $before['custom'] && ! $parts) {
            $parts[] = 'confirmed the '.PermissionCatalog::TEMPLATES[$after['template']].' starting point';
        }

        return [
            'summary' => $parts ? ucfirst(implode('; ', $parts)).'.' : '',
            'detail' => ['granted' => $granted, 'revoked' => $revoked, 'fields' => $fields],
        ];
    }

    private function page(Employee $employee): array
    {
        $employee->load('user');
        $settings = Access::settings($employee);
        $delegations = PermissionDelegation::with(['from', 'grantedBy'])->where('employee_id', $employee->id)->latest('id')->get();

        return [
            'catalog' => PermissionCatalog::groups(),
            'actions' => PermissionCatalog::ACTIONS,
            'templates' => array_map(fn ($key, $label) => ['value' => $key, 'label' => $label, ...PermissionCatalog::template($key)], array_keys(PermissionCatalog::TEMPLATES), PermissionCatalog::TEMPLATES),
            'scopes' => array_map(fn ($key, $label) => ['value' => $key, 'label' => $label], array_keys(PermissionCatalog::SCOPES), PermissionCatalog::SCOPES),
            'departmentOptions' => PermissionCatalog::departments(),
            'settings' => $settings,
            // A management account holds everything, whatever is ticked here.
            'fullAccess' => $employee->user?->role === Role::Admin,
            'hasAccount' => $employee->user !== null,
            'account' => $employee->user ? ['email' => $employee->user->email, 'role' => $employee->user->role->value, 'roleLabel' => $employee->user->role->label()] : null,
            'roles' => array_map(fn (Role $role) => ['value' => $role->value, 'label' => $role->label()], Role::cases()),
            'suggestedEmail' => $employee->work_email,
            'delegated' => Access::delegated($employee),
            'effective' => Access::effective($employee),
            'risks' => PermissionCatalog::review($settings),
            'delegations' => $delegations->map(fn (PermissionDelegation $d) => [
                'id' => $d->id,
                'permissions' => $d->permissions,
                'labels' => array_map(PermissionCatalog::label(...), $d->permissions),
                'from' => $d->from ? ['id' => $d->from->id, 'name' => $d->from->displayName()] : null,
                'startsOn' => $d->starts_on->toDateString(),
                'endsOn' => $d->ends_on->toDateString(),
                'reason' => $d->reason,
                'grantedBy' => $d->grantedBy?->name,
                'state' => $d->state(),
            ])->all(),
            'history' => PermissionEvent::with('user')->where('employee_id', $employee->id)->latest('id')->limit(100)->get()->map(fn (PermissionEvent $e) => [
                'id' => $e->id,
                'action' => $e->action,
                'summary' => $e->summary,
                'granted' => array_map(PermissionCatalog::label(...), $e->changes['granted'] ?? []),
                'revoked' => array_map(PermissionCatalog::label(...), $e->changes['revoked'] ?? []),
                'reason' => $e->changes['reason'] ?? null,
                'by' => $e->user?->name ?? 'System',
                'at' => $e->created_at?->toIso8601String(),
            ])->all(),
        ];
    }
}
