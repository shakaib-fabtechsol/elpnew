<?php

namespace App\Services\Permissions;

use App\Http\Requests\Employees\EmployeeRequest;

/**
 * Everything an employee can be allowed to do in SADEED, as one list.
 *
 * A permission is "module.action" - "expenses.approve". The modules are the
 * ones the platform actually has, grouped the way the navigation groups
 * them, and each offers only the actions that mean something for it: a
 * dashboard is viewed, not approved.
 *
 * Templates are starting points for the usual jobs, not roles a person is
 * locked into: one is applied and then adjusted for the person.
 */
final class PermissionCatalog
{
    public const ACTIONS = [
        'view' => 'View', 'create' => 'Create', 'edit' => 'Edit', 'delete' => 'Delete',
        'approve' => 'Approve', 'reject' => 'Reject', 'pay' => 'Pay',
    ];

    /** How far an employee's access to other people's records reaches. */
    public const SCOPES = [
        'own' => 'Own records only',
        'department' => 'Selected departments',
        'all' => 'All employees',
    ];

    /** The request modules - the ones a decision or a payment is made on. */
    public const REQUEST_MODULES = [
        'financingRequests', 'entitlementRequests', 'allowanceRequests', 'endOfServiceRequests', 'leaveRequests', 'generalRequests',
    ];

    private const CRUD = ['view', 'create', 'edit', 'delete'];

    private const MONEY = ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'pay'];

    /** group => [label, note, modules => [label, note, actions]] */
    private const GROUPS = [
        'workspace' => ['Workspace', 'What the employee sees on signing in', [
            'dashboard' => ['Dashboard', 'Summary, hearings, deadlines and tasks', ['view']],
            'circulars' => ['Circulars', 'Firm circulars and their acknowledgements', self::CRUD],
        ]],
        'legal' => ['Clients & Cases', 'The legal work of the firm', [
            'clients' => ['Clients', 'Client records and their contacts', self::CRUD],
            'cases' => ['Cases', 'Active cases, registration, hearings and judgments', self::CRUD],
            'courtFees' => ['Court Fees', 'Court fee payments and their approval', ['view', 'create', 'edit', 'approve', 'reject', 'pay']],
        ]],
        'records' => ['Employee Records', 'Other employees\' files, within the record access set above', [
            'employees' => ['Employee Records', 'Personal, employment and contract information', self::CRUD],
            'employeeDocuments' => ['Employee Documents', 'Passports, IDs, contracts and other filed papers', ['view', 'create', 'delete']],
            'violations' => ['Violations & Penalties', 'Violations recorded, responses and decisions', ['view', 'create', 'edit', 'approve', 'reject']],
        ]],
        'confidential' => ['Confidential Information', 'Sensitive parts of an employee record', [
            'payroll' => ['Salary & Payroll Details', 'Salary, allowances and deductions on a record', ['view', 'edit']],
            'bankDetails' => ['Bank Details', 'Bank, account number and IBAN', ['view', 'edit']],
            'identity' => ['Identity & Immigration', 'Civil ID, passport, visa and work permit', ['view', 'edit']],
        ]],
        'requests' => ['Request Management', 'Filing, deciding and paying employee requests', [
            'financingRequests' => ['Financing Requests', 'Salary advances, loans and financial assistance', self::MONEY],
            'entitlementRequests' => ['Entitlement Requests', 'Bonus, commission, overtime and leave encashment', self::MONEY],
            'allowanceRequests' => ['Allowance Requests', 'Medical, transportation, travel and air ticket claims', self::MONEY],
            'endOfServiceRequests' => ['End-of-Service Requests', 'Notice pay and end-of-service gratuity', self::MONEY],
            'leaveRequests' => ['Leave Requests', 'Annual, sick and other leave', ['view', 'create', 'edit', 'delete', 'approve', 'reject']],
            'generalRequests' => ['Administrative Requests', 'General requests, grievances and complaints', ['view', 'create', 'approve', 'reject']],
        ]],
        'finance' => ['Finance', 'The firm\'s money', [
            'salaries' => ['Payroll Run', 'Monthly salary payments and transfers', ['view', 'create', 'approve', 'reject', 'pay']],
            'expenses' => ['Expenses', 'General invoices and expense classification', self::MONEY],
            'paymentRequests' => ['Payment Requests', 'Requests for payment raised to finance', ['view', 'create', 'approve', 'reject', 'pay']],
            'taxes' => ['Taxes', 'VAT and tax records', ['view', 'create', 'edit']],
            'suppliers' => ['Suppliers', 'Supplier register', self::CRUD],
        ]],
        'administration' => ['Firm Administration', 'How the firm and the system are set up', [
            'firmSettings' => ['Firm Settings', 'Branches, firm bank accounts and firm details', ['view', 'edit']],
            'permissions' => ['System Permissions', 'What other employees may see and do', ['view', 'edit']],
        ]],
    ];

    public const TEMPLATES = [
        'admin' => 'Management / Admin',
        'accounting' => 'Accounting',
        'lawyer' => 'Lawyer',
        'execution' => 'Execution Team',
        'staff' => 'Staff (Self-Service)',
    ];

    /** The catalogue as the page draws it. */
    public static function groups(): array
    {
        $groups = [];
        foreach (self::GROUPS as $key => [$label, $note, $modules]) {
            $groups[] = [
                'key' => $key, 'label' => $label, 'note' => $note,
                'modules' => array_map(fn ($module, $def) => ['key' => $module, 'label' => $def[0], 'note' => $def[1], 'actions' => $def[2]], array_keys($modules), $modules),
            ];
        }

        return $groups;
    }

    /** @return array<string, array{0:string,1:string,2:list<string>}> */
    public static function modules(): array
    {
        return array_merge(...array_map(fn ($group) => $group[2], array_values(self::GROUPS)));
    }

    /** Every permission there is. @return list<string> */
    public static function keys(): array
    {
        $keys = [];
        foreach (self::modules() as $module => $def) {
            foreach ($def[2] as $action) {
                $keys[] = $module.'.'.$action;
            }
        }

        return $keys;
    }

    /** Only keys that exist, in catalogue order, each once. */
    public static function clean(array $keys): array
    {
        return array_values(array_intersect(self::keys(), array_map('strval', $keys)));
    }

    public static function label(string $key): string
    {
        [$module, $action] = explode('.', $key) + [null, null];

        return (self::modules()[$module][0] ?? $module).': '.(self::ACTIONS[$action] ?? $action);
    }

    public static function departments(): array
    {
        return EmployeeRequest::DEPARTMENTS;
    }

    /**
     * A template's permissions, record access and limits.
     *
     * @return array{grants:list<string>,scope:string}
     */
    public static function template(string $name): array
    {
        $all = self::keys();
        $of = fn (array $modules, array $actions) => array_merge(...array_map(
            fn ($module) => array_map(fn ($action) => $module.'.'.$action, array_intersect($actions, self::modules()[$module][2])),
            $modules,
        ));
        // Everybody files and follows their own requests.
        $selfService = [...$of(self::REQUEST_MODULES, ['view', 'create']), 'dashboard.view', 'circulars.view'];

        return match ($name) {
            'admin' => ['grants' => $all, 'scope' => 'all'],
            'accounting' => ['scope' => 'all', 'grants' => self::clean([
                ...$selfService,
                ...$of(['financingRequests', 'entitlementRequests', 'allowanceRequests', 'endOfServiceRequests', 'salaries', 'expenses', 'paymentRequests', 'courtFees'], ['pay']),
                ...$of(['salaries', 'expenses', 'paymentRequests', 'taxes', 'suppliers'], ['view', 'create', 'edit']),
                ...$of(['employees', 'employeeDocuments', 'payroll', 'bankDetails', 'clients', 'courtFees', 'firmSettings'], ['view']),
            ])],
            'lawyer' => ['scope' => 'own', 'grants' => self::clean([
                ...$selfService,
                ...$of(['clients', 'cases'], ['view', 'create', 'edit']),
                ...$of(['courtFees', 'expenses', 'paymentRequests'], ['view', 'create']),
            ])],
            'execution' => ['scope' => 'own', 'grants' => self::clean([
                ...$selfService,
                ...$of(['cases'], ['view', 'edit']),
                ...$of(['clients'], ['view']),
                ...$of(['courtFees'], ['view', 'create']),
            ])],
            default => ['scope' => 'own', 'grants' => self::clean($selfService)],
        };
    }

    /**
     * What deserves a second look in a set of permissions: one person holding
     * both ends of a control, sensitive access wider than the job, authority
     * with no ceiling. Rules, not opinion - each one says what it found.
     *
     * @param  array{grants:list<string>,scope:string,approvalLimit:?float,paymentLimit:?float,template?:string}  $state
     * @return list<array{level:string,title:string,detail:string,permissions:list<string>}>
     */
    public static function review(array $state): array
    {
        $has = array_flip($state['grants']);
        $risks = [];
        $add = function (string $level, string $title, string $detail, array $permissions = []) use (&$risks) {
            $risks[] = compact('level', 'title', 'detail', 'permissions');
        };

        foreach (self::modules() as $module => [$label]) {
            $approve = isset($has[$module.'.approve']);
            $pay = isset($has[$module.'.pay']);
            $create = isset($has[$module.'.create']);

            if ($approve && $pay) {
                $add('high', 'Approves and pays '.$label, 'The same person can approve and pay, so no second person is involved in releasing the money.', [$module.'.approve', $module.'.pay']);
            } elseif ($create && $approve && in_array($module, self::REQUEST_MODULES, true)) {
                $add('medium', 'Files and approves '.$label, 'Can approve a kind of request they also file. Make sure their own requests go to somebody else.', [$module.'.create', $module.'.approve']);
            }
        }

        $isAdmin = ($state['template'] ?? null) === 'admin';

        if (isset($has['permissions.edit']) && ! $isAdmin) {
            $add('high', 'Can change system permissions', 'Able to grant access to anybody, including themselves through another account.', ['permissions.edit']);
        }

        $sensitive = array_values(array_filter(['payroll.view', 'bankDetails.view', 'identity.view'], fn ($key) => isset($has[$key])));
        if ($sensitive && $state['scope'] === 'all' && ! in_array($state['template'] ?? '', ['admin', 'accounting'], true)) {
            $add('medium', 'Confidential information for all employees', 'Sees salary, bank or identity details across the whole firm. Limit record access to selected departments if the job does not need it.', $sensitive);
        }

        $approves = array_values(array_filter($state['grants'], fn ($key) => str_ends_with($key, '.approve') && self::isMoney($key)));
        if ($approves && $state['approvalLimit'] === null && ! $isAdmin) {
            $add('low', 'No approval limit', 'May approve amounts of any size. Set an approval limit to match their authority.', $approves);
        }

        $pays = array_values(array_filter($state['grants'], fn ($key) => str_ends_with($key, '.pay')));
        if ($pays && $state['paymentLimit'] === null && ! $isAdmin) {
            $add('low', 'No payment limit', 'May pay amounts of any size. Set a payment limit to match their authority.', $pays);
        }

        $deletes = array_values(array_filter($state['grants'], fn ($key) => str_ends_with($key, '.delete')));
        if (count($deletes) >= 4 && ! $isAdmin) {
            $add('low', 'Delete access in '.count($deletes).' modules', 'Deleting is rarely needed day to day. Keep it for the few who administer each module.', $deletes);
        }

        // The most serious first.
        $order = ['high' => 0, 'medium' => 1, 'low' => 2];
        usort($risks, fn ($a, $b) => $order[$a['level']] <=> $order[$b['level']]);

        return $risks;
    }

    private static function isMoney(string $key): bool
    {
        return in_array('pay', self::modules()[explode('.', $key)[0]][2] ?? [], true);
    }
}
