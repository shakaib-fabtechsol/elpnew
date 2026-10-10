<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\Invoices\InvoiceRiskChecker;
use App\Services\Requests\InterpreterUnavailable;
use App\Services\Requests\RequestCatalog;
use App\Services\Requests\RequestInterpreter;
use App\Services\Requests\RuleBasedRequestInterpreter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The unified request: one free-text box (and an optional document) instead
 * of choosing among the fixed forms.
 *
 *   POST /requests/interpret   text and/or file -> what the AI understood:
 *                              the type, each field with its value, and what
 *                              is still missing. Nothing is saved.
 *   POST /requests/submit      the reviewed type + fields -> the request is
 *                              created by that module's own endpoint, so its
 *                              limits, numbering and workflow apply unchanged.
 *
 * The AI proposes and the employee confirms: a request for money or leave is
 * never created from a reading nobody looked at.
 */
class UnifiedRequestController extends Controller
{
    /** Where a module's own field names sit on the unified review. */
    private const FIELD_OF = [
        'loanAmount' => 'amount', 'comment' => 'reason', 'notes' => 'reason', 'from' => 'fromDate', 'to' => 'toDate',
        'type' => 'leaveType', 'purposeOther' => 'reason', 'bonusType' => 'reason',
    ];

    public function interpret(Request $request, RequestInterpreter $interpreter, InvoiceRiskChecker $risk): JsonResponse
    {
        $data = $request->validate([
            'text' => ['nullable', 'string', 'max:2000', 'required_without:file'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'employeeId' => ['nullable', 'integer'],
        ], ['text.required_without' => 'Write your request, or attach a document.']);

        $employee = $this->employeeFor($request, $data['employeeId'] ?? null);
        $file = $request->file('file');
        $notes = [];

        try {
            $proposal = $interpreter->interpret($data['text'] ?? null, $file);
        } catch (InterpreterUnavailable) {
            // The AI is down or not answering: the plain reader still gets
            // the employee to a request, and the screen says which was used.
            $proposal = (new RuleBasedRequestInterpreter)->interpret($data['text'] ?? null, $file);
            $notes[] = 'The AI service could not be reached, so the request was read with basic rules. Please check every field.';
        }

        if ($proposal['engine'] === 'rules' && ! $notes) {
            $notes[] = 'AI reading is not switched on, so the request was read with basic rules. Please check every field.';
        }

        $type = $proposal['type'];
        if (! $type) {
            return response()->json(['data' => [
                'type' => null,
                'engine' => $proposal['engine'],
                'summary' => $proposal['summary'] ?: 'The request could not be recognised.',
                'notes' => [...$notes, 'Say what you are asking for - for example "salary advance of 300 OMR from November salary" - or choose a request type yourself.'],
                'types' => $this->typeOptions(),
            ]]);
        }

        return response()->json(['data' => $this->draft($type, $proposal, $data['text'] ?? null, $employee, $risk, $notes, (bool) $file)]);
    }

    /**
     * The same review for a type the employee picked by hand (when the AI
     * could not tell, or guessed wrong): the fields of that type, keeping
     * whatever values carry over.
     */
    public function retype(Request $request, InvoiceRiskChecker $risk): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(RequestCatalog::TYPES))],
            'fields' => ['nullable', 'array'],
            'invoice' => ['nullable', 'array'],
            'employeeId' => ['nullable', 'integer'],
        ]);
        $employee = $this->employeeFor($request, $data['employeeId'] ?? null);

        $proposal = ['fields' => $data['fields'] ?? [], 'invoice' => $data['invoice'] ?? null, 'confidence' => 1.0, 'summary' => '', 'engine' => 'manual'];

        return response()->json(['data' => $this->draft($data['type'], $proposal, null, $employee, $risk, [], false)]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(RequestCatalog::TYPES))],
            // Not required: a claim whose only detail is its invoice has no
            // field filled, and an empty list does not travel in a form post.
            'fields' => ['nullable', 'array'],
            'invoice' => ['nullable', 'array'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'employeeId' => ['nullable', 'integer'],
        ]);

        $type = $data['type'];
        $values = RequestCatalog::clean($type, $data['fields'] ?? []);
        $invoice = RequestCatalog::cleanInvoice($data['invoice'] ?? null);

        $missing = RequestCatalog::missing($type, $values, $invoice !== null);
        if ($missing) {
            throw ValidationException::withMessages(collect($missing)->mapWithKeys(fn ($key) => [
                $key => [$key === 'invoice'
                    ? 'Attach the invoice this claim is for - it could not be read.'
                    : 'This field is required.'],
            ])->all());
        }

        $payload = RequestCatalog::payload($type, $values, $invoice);
        $body = array_filter($payload['body'], fn ($value) => $value !== null);
        if ($data['employeeId'] ?? null) {
            $body['employeeId'] = $data['employeeId'];
        }

        $files = $payload['file'] && $request->file('file') ? [$payload['file'] => $request->file('file')] : [];
        $response = $this->forward($request, $payload['endpoint'], $body, $files);
        $result = json_decode($response->getContent(), true) ?? [];

        if ($response->getStatusCode() === 422) {
            // The module's own refusal (a limit, an open request...), told
            // against the field the employee sees on the review.
            $errors = [];
            foreach ($result['errors'] ?? [] as $field => $messages) {
                $errors[self::FIELD_OF[$field] ?? $field] = $messages;
            }

            return response()->json(['message' => $result['message'] ?? 'The request could not be created.', 'errors' => $errors], 422);
        }

        if ($response->getStatusCode() >= 400) {
            return response()->json(['message' => $result['message'] ?? 'The request could not be created.'], $response->getStatusCode());
        }

        $record = $result['data'] ?? [];

        return response()->json(['data' => [
            'type' => $type,
            'typeLabel' => RequestCatalog::label($type),
            'requestNo' => $record['requestNo'] ?? $record['leaveNo'] ?? null,
            'record' => $record,
        ]], 201);
    }

    /* ---------------------------------------------------------- helpers */

    private function draft(string $type, array $proposal, ?string $text, Employee $employee, InvoiceRiskChecker $risk, array $notes, bool $hasFile): array
    {
        $values = RequestCatalog::clean($type, $proposal['fields']);

        // What the employee wrote is the reason unless the AI put it better.
        if (($values['reason'] ?? null) === null && filled($text) && collect(RequestCatalog::fields($type))->contains('key', 'reason')) {
            $values['reason'] = mb_substr(trim($text), 0, 500);
        }

        $needsInvoice = in_array($type, RequestCatalog::INVOICE_TYPES, true);
        $invoice = $needsInvoice ? RequestCatalog::cleanInvoice($proposal['invoice'] ?? null) : null;

        if ($needsInvoice && ! $invoice) {
            $notes[] = $hasFile
                ? 'The attached document could not be read as an invoice. Attach a clear copy of the invoice (PDF or photo).'
                : 'This kind of request is made on an invoice. Attach the invoice and it will be read for you.';
        }

        return [
            'type' => $type,
            'typeLabel' => RequestCatalog::label($type),
            'confidence' => $proposal['confidence'],
            'summary' => $proposal['summary'],
            'engine' => $proposal['engine'],
            'fields' => array_map(fn ($field) => [...$field, 'value' => $values[$field['key']]], RequestCatalog::fields($type)),
            'missing' => RequestCatalog::missing($type, $values, $invoice !== null),
            'invoice' => $invoice,
            // The same checks management will see: duplicate invoice, repeated
            // medication, VAT that does not add up, an old invoice.
            'risk' => $invoice ? $risk->check($invoice, $type, $employee->id) : null,
            'notes' => $notes,
            'types' => $this->typeOptions(),
        ];
    }

    private function typeOptions(): array
    {
        return array_map(fn ($key, $def) => ['value' => $key, 'label' => $def[0]], array_keys(RequestCatalog::TYPES), RequestCatalog::TYPES);
    }

    private function employeeFor(Request $request, ?int $employeeId): Employee
    {
        $user = $request->user();
        if ($employeeId && $user->can('manage')) {
            return Employee::findOrFail($employeeId);
        }
        if (! $user->employee) {
            throw ValidationException::withMessages(['employeeId' => 'Your account is not linked to an employee record.']);
        }

        return $user->employee;
    }

    /**
     * Hands the request to the module's own endpoint, inside this request:
     * the same route, the same validation, the same rules as the fixed form.
     */
    private function forward(Request $request, string $endpoint, array $body, array $files)
    {
        $sub = Request::create('/api/v1/'.$endpoint, 'POST', $body, $request->cookies->all(), $files, [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => (string) $request->header('Authorization'),
            'REMOTE_ADDR' => $request->ip(),
        ]);
        $sub->setUserResolver($request->getUserResolver());

        // Form requests are built from the container's current request.
        $original = app('request');
        app()->instance('request', $sub);
        try {
            return app('router')->dispatch($sub);
        } finally {
            app()->instance('request', $original);
        }
    }
}
