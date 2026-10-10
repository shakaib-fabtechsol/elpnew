<?php

namespace App\Http\Requests\Workflow;

use App\Http\Requests\ApiRequest;

/** Financial Department Actions: how and when the approved amount was paid. */
class PaymentRequest extends ApiRequest
{
    public const METHODS = ['Bank Transfer', 'Cheque', 'Cash'];

    /** The financial department (and management) pays. */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('pay');
    }

    public function rules(): array
    {
        $cash = $this->input('paymentMethod') === 'Cash';

        return [
            'paymentMethod' => ['required', 'string', 'in:'.implode(',', self::METHODS)],
            'paymentDate' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            // A transfer or cheque has a reference to trace it by; the account it
            // left from is recorded where the screen asks for it (the designs'
            // finance step pays into the employee's own account and does not).
            'bankAccount' => ['nullable', 'string', 'max:120'],
            'paymentReference' => [$cash ? 'nullable' : 'required', 'string', 'max:60'],
            'financeComment' => ['nullable', 'string', 'max:300'],
            'expenseType' => ['nullable', 'string', 'max:60'],
            'category' => ['nullable', 'string', 'max:60'],
            'subcategory' => ['nullable', 'string', 'max:60'],
        ];
    }

    public function messages(): array
    {
        return [
            'paymentDate.before_or_equal' => 'A payment cannot be dated in the future.',
            'paymentReference.required' => 'Enter the bank reference for the transfer.',
        ];
    }
}
