<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EntitlementRequest;
use App\Services\Invoices\DemoInvoiceReader;
use App\Services\Invoices\InvoiceReader;
use App\Services\Invoices\InvoiceRiskChecker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Step 1 of an invoice-based request: the employee uploads the invoice, it is
 * read and checked, and the result fills the request for them to confirm.
 * Nothing is saved here - the request is filed on Submit.
 */
class InvoiceAnalysisController extends Controller
{
    public function __invoke(Request $request, InvoiceReader $reader, InvoiceRiskChecker $risk): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'kind' => ['required', Rule::in(EntitlementRequest::INVOICE_KINDS)],
            'employeeId' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $employee = ($data['employeeId'] ?? null) && $user->can('manage')
            ? Employee::findOrFail($data['employeeId'])
            : $user->employee;
        abort_unless($employee, 422, 'Your account is not linked to an employee record.');

        $previous = EntitlementRequest::where('employee_id', $employee->id)
            ->where('kind', $data['kind'])
            ->whereNotNull('invoice')
            ->latest('request_date')
            ->value('invoice');

        $invoice = $reader->read($request->file('file'), $data['kind'], $previous);

        return response()->json([
            'data' => [
                'invoice' => $invoice,
                'risk' => $risk->check($invoice, $data['kind'], $employee->id),
                // Tells the screen this reading is a stand-in until the AI is connected.
                'demo' => $reader instanceof DemoInvoiceReader,
            ],
        ]);
    }
}
