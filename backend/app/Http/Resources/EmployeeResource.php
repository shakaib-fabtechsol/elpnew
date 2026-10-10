<?php

namespace App\Http\Resources;

use App\Services\LeaveBalance;
use Illuminate\Http\Request;

/**
 * An employee as the app reads one: every field, the two names under the
 * keys the form uses as well, and the pay totals worked out from the parts.
 */
class EmployeeResource extends ApiResource
{
    protected array $except = ['deleted_at'];

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
