<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employees\EntitlementRequestForm;
use App\Models\Employee;
use App\Models\EntitlementRequest;
use App\Models\Supplier;
use App\Services\Invoices\InvoiceRiskChecker;
use App\Services\LeaveBalance;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Allowances, overtime, leave encashment, notice pay and end of service.
 * Invoice-based kinds start from the invoice analysis: the claim is the
 * invoice total less what insurance covered, the checks are run again on
 * submit, and an unknown supplier is registered with its VAT number.
 */
class EntitlementRequestController extends MoneyRequestController
{
    protected string $model = EntitlementRequest::class;

    protected string $form = EntitlementRequestForm::class;

    protected string $dateColumn = 'request_date';

    protected array $searchColumns = ['entitlement_no', 'invoice_no', 'reason'];

    public function __construct(RequestWorkflow $workflow, private InvoiceRiskChecker $risk)
    {
        parent::__construct($workflow);
    }

    protected function filter(Builder $query, Request $request): void
    {
        $query->when($request->string('kind')->toString(), fn (Builder $q, string $kind) => $q->where('kind', $kind));
    }

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        $kind = $data['kind'];
        if ($existing && $existing->kind !== $kind) {
            throw ValidationException::withMessages(['kind' => 'The kind of a request cannot be changed.']);
        }
        unset($data['confirmed']);

        $data['request_date'] = $existing?->request_date?->format('Y-m-d') ?? now()->format('Y-m-d');
        $salary = (float) $employee->salary;

        switch ($kind) {
            case 'leaveEncashment':
                $data['amount'] = EntitlementRequest::encashmentAmount($salary, (float) $data['days']);
                break;

            case 'overtime':
                $data['amount'] = EntitlementRequest::overtimeAmount($salary, (float) $data['hours']);
                break;

            case 'medical':
            case 'travel':
            case 'airTicket':
            case 'transport':
                $invoice = $data['invoice'];
                $insurance = (float) ($data['insurance_covered'] ?? 0);
                if ($insurance >= (float) $invoice['total']) {
                    throw ValidationException::withMessages(['insuranceCovered' => 'Insurance cannot cover the whole invoice - there would be nothing to claim.']);
                }

                // The checks run again here: what the screen showed is not trusted.
                $risk = $this->risk->check($invoice, $kind, $employee->id, $existing?->id);
                $supplier = Supplier::matching($invoice['supplierVat'] ?? null, $invoice['supplierName'])
                    ?? Supplier::create([
                        'name' => $invoice['supplierName'],
                        'vat_number' => $invoice['supplierVat'] ?? null,
                        'commercial_registration' => $invoice['supplierCr'] ?? null,
                        'phone' => $invoice['supplierPhone'] ?? null,
                        'category' => $invoice['supplierCategory'] ?? ($kind === 'medical' ? 'Medical' : 'Other'),
                        'auto_registered' => true,
                    ]);

                $data['amount'] = round((float) $invoice['total'] - $insurance, 3);
                $data['insurance_covered'] = $insurance;
                $data['invoice_no'] = $invoice['invoiceNo'];
                $data['supplier_id'] = $supplier->id;
                $data['risk'] = $risk;
                break;
        }

        return $data;
    }

    protected function guard(array $data, Employee $employee, ?Model $existing): void
    {
        if ($data['kind'] === 'leaveEncashment') {
            $balance = LeaveBalance::for($employee->id, $data['leave_type'], (int) $data['year']);
            if (! $balance || $data['days'] > $balance['remaining']) {
                throw ValidationException::withMessages([
                    'days' => 'Only '.($balance['remaining'] ?? 0).' days of '.$data['leave_type'].' are left to encash in '.$data['year'].'.',
                ]);
            }
        }
    }
}
