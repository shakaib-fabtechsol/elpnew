<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\Commission;
use Illuminate\Validation\Rule;

class CommissionRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'employeeId' => ['required', 'integer', 'exists:employees,id'],
            'type' => ['required', Rule::in([Commission::FIXED, Commission::INVOICE_LINKED])],
            'classification' => ['nullable', Rule::in(Commission::CLASSIFICATIONS)],
            'clientNo' => ['required', 'string', 'max:20'],
            'clientName' => ['required', 'string', 'max:255'],
            'caseFileNo' => ['nullable', 'string', 'max:30'],
            'invoiceNo' => ['nullable', 'string', 'max:40', 'required_if:type,'.Commission::INVOICE_LINKED],
            'rate' => ['required', 'numeric', 'gt:0', 'max:100'],
            'periodFrom' => ['required', 'date_format:Y-m-d'],
            'periodTo' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:periodFrom'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }
}
