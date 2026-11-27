<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\SalaryAdvance;
use Illuminate\Validation\Rule;

class SalaryAdvanceRequest extends ApiRequest
{
    public function rules(): array
    {
        $year = (int) now()->format('Y');

        return [
            'employeeId' => ['nullable', 'integer'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'deductMonth' => ['required', Rule::in(SalaryAdvance::MONTHS)],
            'deductYear' => ['required', 'integer', 'between:'.$year.','.($year + 1)],
            // The Add Request sheet asks only for the month and the amount, so
            // the purpose is optional; the controller fills it in.
            'purpose' => ['nullable', Rule::in(SalaryAdvance::PURPOSES)],
            'purposeOther' => ['nullable', 'string', 'max:120', 'required_if:purpose,'.SalaryAdvance::OTHER_PURPOSE],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['purposeOther.required_if' => 'Say what the advance is for.'];
    }
}
