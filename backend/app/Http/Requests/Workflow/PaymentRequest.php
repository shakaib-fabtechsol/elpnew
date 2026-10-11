<?php

namespace App\Http\Requests\Workflow;

use App\Http\Requests\ApiRequest;
use Illuminate\Support\Facades\Storage;

/** Financial Department Actions: how and when the approved amount was paid. */
class PaymentRequest extends ApiRequest
{
    /** The methods the payment step offers on every screen (PAYMENT_METHODS in the app). */
    public const METHODS = ['Bank Transfer', 'Cheque', 'Cash', 'Card', 'Direct Debit'];

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
            // The bank's proof of the transfer, kept with the payment.
            'receipt' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    /** The payment's columns; the receipt is a file, stored by `receiptColumns()`. */
    public function columns(): array
    {
        $columns = parent::columns();
        unset($columns['receipt']);

        return $columns;
    }

    /**
     * Stores the receipt privately and returns the columns that point to it -
     * nothing when none was attached. The name it was uploaded under is kept,
     * because the stored one is a hash nobody would recognise.
     */
    public function receiptColumns(int $employeeId): array
    {
        $file = $this->file('receipt');

        return $file ? [
            'payment_receipt' => $file->store('payments/'.$employeeId, 'local'),
            'payment_receipt_name' => $file->getClientOriginalName(),
        ] : [];
    }

    /** Removes a receipt just stored for a payment that was then refused. */
    public static function discard(array $receipt): void
    {
        if ($receipt) {
            Storage::disk('local')->delete($receipt['payment_receipt']);
        }
    }

    public function messages(): array
    {
        return [
            'paymentDate.before_or_equal' => 'A payment cannot be dated in the future.',
            'paymentReference.required' => 'Enter the bank reference for the transfer.',
        ];
    }
}
