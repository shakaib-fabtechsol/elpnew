<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\EntitlementRequest;
use Illuminate\Validation\Rule;

/**
 * What each kind asks for. Amounts that can be worked out (overtime from
 * hours, encashment from days, an invoice claim from the invoice less
 * insurance) are not accepted from the client - the controller works them out.
 */
class EntitlementRequestForm extends ApiRequest
{
    public function rules(): array
    {
        $kind = $this->input('kind');
        $invoice = EntitlementRequest::needsInvoice((string) $kind);
        $typed = in_array($kind, ['notice', 'endOfService'], true);

        return [
            'employeeId' => ['nullable', 'integer'],
            'kind' => ['required', Rule::in(array_keys(EntitlementRequest::KINDS))],
            'reason' => ['nullable', 'string', 'max:500'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],

            // Leave encashment
            'year' => [Rule::requiredIf($kind === 'leaveEncashment'), 'nullable', 'integer', 'between:2000,2100'],
            'leaveType' => [Rule::requiredIf($kind === 'leaveEncashment'), 'nullable', Rule::in(['Annual Leave'])],
            'days' => [Rule::requiredIf($kind === 'leaveEncashment'), 'nullable', 'numeric', 'gt:0', 'max:60'],

            // Overtime
            'period' => [Rule::requiredIf($kind === 'overtime'), 'nullable', 'date_format:Y-m', 'before_or_equal:'.now()->format('Y-m')],
            'hours' => [Rule::requiredIf($kind === 'overtime'), 'nullable', 'numeric', 'gt:0', 'max:300'],

            // Transport
            'transportType' => ['nullable', Rule::in(['general', 'court'])],
            'caseFileNo' => ['nullable', 'string', 'max:30', 'required_if:transportType,court'],
            'travelDate' => ['nullable', 'date_format:Y-m-d', 'required_if:transportType,court'],

            // Invoice-based claims: the invoice as the analysis read it, and the
            // employee's confirmation that it is right.
            'invoice' => [Rule::requiredIf($invoice), 'nullable', 'array'],
            'invoice.invoiceNo' => [Rule::requiredIf($invoice), 'string', 'max:60'],
            'invoice.invoiceDate' => [Rule::requiredIf($invoice), 'date_format:Y-m-d', 'before_or_equal:today'],
            'invoice.supplierName' => [Rule::requiredIf($invoice), 'string', 'max:255'],
            'invoice.supplierVat' => ['nullable', 'string', 'max:30'],
            'invoice.supplierCr' => ['nullable', 'string', 'max:30'],
            'invoice.supplierPhone' => ['nullable', 'string', 'max:30'],
            'invoice.supplierCategory' => ['nullable', 'string', 'max:60'],
            'invoice.purpose' => ['nullable', 'string', 'max:255'],
            'invoice.items' => [Rule::requiredIf($invoice), 'array', 'min:1'],
            'invoice.items.*.name' => ['required', 'string', 'max:255'],
            'invoice.items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'invoice.items.*.amount' => ['required', 'numeric', 'min:0'],
            'invoice.subtotal' => [Rule::requiredIf($invoice), 'numeric', 'min:0'],
            'invoice.vat' => [Rule::requiredIf($invoice), 'numeric', 'min:0'],
            'invoice.total' => [Rule::requiredIf($invoice), 'numeric', 'gt:0'],
            'invoice.fileName' => ['nullable', 'string', 'max:255'],
            'insuranceCovered' => ['nullable', 'numeric', 'min:0'],
            // `accepted` runs even on a missing field, so it is only asked where
            // there is an invoice to confirm.
            'confirmed' => $invoice ? ['required', 'accepted'] : ['nullable'],

            // Notice pay and end of service: a sum the employee names.
            'amount' => [Rule::requiredIf($typed), 'nullable', 'numeric', 'gt:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'invoice.required' => 'Upload the invoice first - the request is filled in from it.',
            'confirmed.required' => 'Confirm that the details read from the invoice are correct.',
            'confirmed.accepted' => 'Confirm that the details read from the invoice are correct.',
            'period.before_or_equal' => 'Overtime cannot be claimed for a month that has not happened yet.',
        ];
    }
}
