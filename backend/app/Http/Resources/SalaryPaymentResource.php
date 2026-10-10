<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class SalaryPaymentResource extends ApiResource
{
    protected array $except = ['paid_by'];

    private const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    protected function extra(Request $request): array
    {
        return [
            // The number the list shows: the salary's, or the request's until it has one.
            'reference_no' => $this->salary_no ?? $this->request_no,
            'period' => self::MONTHS[$this->month - 1].' '.$this->year,
            'gross' => $this->gross(),
            'deductions' => $this->deductions(),
            'net' => $this->net(),
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id, 'empNo' => $this->employee->emp_no, 'name' => $this->employee->name,
                'bankName' => $this->employee->bank_name, 'accountNumber' => $this->employee->account_number,
            ]),
        ];
    }
}
