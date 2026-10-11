<?php

namespace App\Http\Resources;

use App\Services\LeaveBalance;
use App\Services\Permissions\Access;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * An employee as the app reads one: every field, the two names under the
 * keys the form uses as well, and the pay totals worked out from the parts.
 */
class EmployeeResource extends ApiResource
{
    protected array $except = ['deleted_at'];

    /** The confidential parts of a record, and the permission that opens each. */
    private const CONFIDENTIAL = [
        'payroll.view' => ['salary', 'salary_effective_date', 'special', 'housing', 'phone_allowance', 'transport', 'electricity', 'water',
            'loan', 'salary_advance', 'disciplinary', 'other_deduction', 'administrative', 'total_allowances', 'total_deductions', 'gross_salary', 'net_salary'],
        'bankDetails.view' => ['bank_name', 'account_holder', 'account_number', 'iban', 'swift_code'],
        'identity.view' => ['civil_id', 'id_expiry', 'passport_number', 'passport_expiry', 'visa_no', 'visa_expiry', 'work_permit_no', 'work_permit_expiry'],
    ];

    /**
     * A record somebody else opens comes without the confidential parts
     * they have not been given: salary, bank details, identity papers. The
     * fields are sent empty rather than left out, and `restricted` says
     * which parts were held back so the screen can say so. One's own record
     * is always whole.
     */
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);
        $user = $request->user();
        $restricted = [];

        if ($user && $user->employee_id !== $this->id) {
            foreach (self::CONFIDENTIAL as $permission => $columns) {
                // Whoever pays requests is shown where the money goes: the
                // payment step puts the employee's bank and account number at
                // its head so a transfer needs no looking up.
                $pays = $permission === 'bankDetails.view' && Access::allowsOnRequests($user, 'pay');

                if (! $pays && ! Access::allows($user, $permission)) {
                    $restricted[] = explode('.', $permission)[0];
                    foreach ($columns as $column) {
                        $data[Str::camel($column)] = null;
                    }
                }
            }
        }

        return [...$data, 'restricted' => $restricted];
    }

    protected function extra(Request $request): array
    {
        $balance = LeaveBalance::for($this->id, 'Annual Leave', (int) now()->format('Y'));

        return [
            'employeeName' => $this->name,
            'arabicName' => $this->name_ar,
            'totalAllowances' => $this->totalAllowances(),
            'totalDeductions' => $this->totalDeductions(),
            'grossSalary' => $this->grossSalary(),
            'netSalary' => $this->netSalary(),
            'onLeaveToday' => LeaveBalance::onLeaveToday($this->id),
            'annualLeaveLeft' => $balance['remaining'] ?? null,
            'hasAccount' => $this->whenLoaded('user', fn () => $this->user !== null),
        ];
    }
}
