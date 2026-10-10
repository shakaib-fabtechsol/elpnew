<?php

namespace App\Http\Requests\Workflow;

use App\Enums\Decision;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** Management Decision: full / partial / return / reject. */
class DecisionRequest extends ApiRequest
{
    /** Management decides - refused before the body is even read. */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage');
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::enum(Decision::class)],
            'approvedAmount' => ['nullable', 'numeric', 'min:0', 'required_if:decision,partial'],
            // Loans: a partial approval may change the installment too.
            'approvedMonthly' => ['nullable', 'numeric', 'gt:0'],
            'comment' => ['nullable', 'string', 'max:300', 'required_if:decision,return,reject'],
        ];
    }

    public function messages(): array
    {
        return [
            'approvedAmount.required_if' => 'Enter the amount approved.',
            'comment.required_if' => 'A comment is required when returning or rejecting a request.',
        ];
    }

    public function decision(): Decision
    {
        return Decision::from($this->validated('decision'));
    }
}
