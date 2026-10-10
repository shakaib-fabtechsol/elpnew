<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\AssistanceRequest;
use Illuminate\Validation\Rule;

class AssistanceRequestForm extends ApiRequest
{
    public function rules(): array
    {
        return [
            'employeeId' => ['nullable', 'integer'],
            'assistanceType' => ['required', Rule::in(array_keys(AssistanceRequest::TYPES))],
            'beneficiary' => ['nullable', Rule::in(AssistanceRequest::BENEFICIARIES)],
            'amount' => ['required', 'numeric', 'gt:0'],
            'purpose' => ['nullable', 'string', 'max:255'],
            // Employee Comment - required on the design.
            'notes' => ['required', 'string', 'max:500'],
            'proof' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return ['notes.required' => 'Enter the reason for this assistance request.'];
    }
}
