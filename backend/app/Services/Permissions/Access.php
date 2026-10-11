<?php

namespace App\Services\Permissions;

use App\Enums\Role;
use App\Models\Employee;
use App\Models\EmployeePermission;
use App\Models\PermissionDelegation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * What a person may actually do: the permissions set for them (or their
 * job's template where nobody has set any), plus whatever is delegated to
 * them today.
 *
 * A management account always has everything. It is the one account that
 * cannot be locked out by a mistake on the permissions page.
 */
final class Access
{
    /** The template a person starts from: their account's role, else their job. */
    public static function templateFor(Employee $employee): string
    {
        // Asked for outright: a record that came out of a list has no user loaded.
        $role = ($employee->relationLoaded('user') ? $employee->user : $employee->user()->first())?->role;
        if ($role) {
            return $role->value;
        }

        return match ($employee->occupation) {
            'Partner' => 'admin',
            'Accountant' => 'accounting',
            'Lawyer', 'Legal Consultant' => 'lawyer',
            default => 'staff',
        };
    }

    /**
     * The settings as they stand - saved, or the template's.
     *
     * @return array{template:string,grants:list<string>,scope:string,departments:list<string>,approvalLimit:?float,paymentLimit:?float,custom:bool}
     */
    public static function settings(Employee $employee): array
    {
        $saved = EmployeePermission::where('employee_id', $employee->id)->first();
        if ($saved) {
            return [
                'template' => $saved->template,
                'grants' => PermissionCatalog::clean($saved->grants ?? []),
                'scope' => $saved->scope,
                'departments' => array_values($saved->departments ?? []),
                'approvalLimit' => $saved->approval_limit,
                'paymentLimit' => $saved->payment_limit,
                'custom' => true,
            ];
        }

        $template = self::templateFor($employee);

        return [
            'template' => $template,
            ...PermissionCatalog::template($template),
            'departments' => [],
            'approvalLimit' => null,
            'paymentLimit' => null,
            'custom' => false,
        ];
    }

    /** Delegations in force today. */
    public static function delegated(Employee $employee): array
    {
        return PermissionCatalog::clean(
            PermissionDelegation::where('employee_id', $employee->id)->active()->pluck('permissions')->flatten()->all()
        );
    }

    /** Everything the employee holds today, their own and delegated. */
    public static function effective(Employee $employee): array
    {
        if (self::templateIsAdminAccount($employee)) {
            return PermissionCatalog::keys();
        }

        return PermissionCatalog::clean([...self::settings($employee)['grants'], ...self::delegated($employee)]);
    }

    /** A management account: everything, whatever is ticked. */
    public static function templateIsAdminAccount(Employee $employee): bool
    {
        return ($employee->relationLoaded('user') ? $employee->user : $employee->user()->first())?->role === Role::Admin;
    }

    /** True when the user holds any one of the permissions. */
    public static function allows(User $user, string ...$keys): bool
    {
        if ($user->role === Role::Admin) {
            return true;
        }
        if (! $user->employee) {
            // An account with no employee record has its role's template.
            return (bool) array_intersect($keys, PermissionCatalog::template($user->role->value)['grants']);
        }

        return (bool) array_intersect($keys, self::effective($user->employee));
    }

    /** Any of an action across the request modules: "approve", "pay". */
    public static function allowsOnRequests(User $user, string $action): bool
    {
        return self::allows($user, 'salaries.'.$action, ...array_map(fn ($module) => $module.'.'.$action, PermissionCatalog::REQUEST_MODULES));
    }

    /** own | department | all */
    public static function scope(User $user): string
    {
        if ($user->role === Role::Admin) {
            return 'all';
        }
        if (! $user->employee) {
            return PermissionCatalog::template($user->role->value)['scope'];
        }

        return self::settings($user->employee)['scope'];
    }

    /** The departments whose people this user's access reaches. */
    public static function departments(User $user): array
    {
        $settings = $user->employee ? self::settings($user->employee) : ['departments' => []];

        // None chosen means their own department.
        return $settings['departments'] ?: array_filter([$user->employee?->department]);
    }

    public static function seesEveryone(User $user): bool
    {
        return self::scope($user) === 'all';
    }

    /** Whether the user's record access reaches this employee. */
    public static function reaches(User $user, Employee $employee): bool
    {
        if ($user->employee_id === $employee->id) {
            return true;
        }

        return match (self::scope($user)) {
            'all' => true,
            'department' => in_array($employee->department, self::departments($user), true),
            default => false,
        };
    }

    /** Narrows a query over records that belong to employees to those the user's access reaches. */
    public static function restrict(Builder $query, User $user, string $column = 'employee_id'): Builder
    {
        return match (self::scope($user)) {
            'all' => $query,
            'department' => $query->where(fn (Builder $q) => $q
                ->where($column, $user->employee_id)
                ->orWhereIn($column, Employee::whereIn('department', self::departments($user))->select('id'))),
            default => $query->where($column, $user->employee_id),
        };
    }

    /** The most the user may approve or pay on one request; null for no ceiling. */
    public static function limit(User $user, string $kind): ?float
    {
        if ($user->role === Role::Admin || ! $user->employee) {
            return null;
        }
        $settings = self::settings($user->employee);

        return $kind === 'payment' ? $settings['paymentLimit'] : $settings['approvalLimit'];
    }

    /** Refuses an amount above the user's authority. */
    public static function withinLimit(User $user, string $kind, float $amount): void
    {
        $limit = self::limit($user, $kind);
        abort_if($limit !== null && $amount > $limit, 403, sprintf(
            'This is above your %s limit of %s OMR. It needs somebody with higher authority.',
            $kind === 'payment' ? 'payment' : 'approval',
            number_format($limit, 3),
        ));
    }
}
