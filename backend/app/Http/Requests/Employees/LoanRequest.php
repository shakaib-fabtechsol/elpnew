<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;

class LoanRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'employeeId' => ['nullable', 'integer'],
            'loanAmount' => ['required', 'numeric', 'gt:0'],
            'monthly' => ['required', 'numeric', 'gt:0', 'lte:loanAmount'],
            // "November 2026": an installment always comes off a month's pay.
            'startMonth' => ['required', 'string', 'regex:/^[A-Z][a-z]+ \d{4}$/'],
            'comment' => ['nullable', 'string', 'max:500'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'monthly.lte' => 'The monthly installment cannot be more than the loan itself.',
            'startMonth.regex' => 'Choose the month deductions start from.',
        ];
    }
}
