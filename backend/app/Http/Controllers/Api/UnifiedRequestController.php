<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\Eligibility;
use App\Services\Invoices\InvoiceRiskChecker;
use App\Services\LeaveBalance;
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
            $proposal = $interpreter->interpret($data['text'] ?? null, $file, $this->known($employee));
        } catch (InterpreterUnavailable $down) {
            // The AI is down or not answering: the plain reader still gets
            // the employee to a request, and the screen says which was used.
            $proposal = (new RuleBasedRequestInterpreter)->interpret($data['text'] ?? null, $file);
            $notes[] = $this->fallbackNote($down, 'the request');
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
                'employee' => $this->employeeCard($employee),
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

    /**
     * The draft brought up to date from what the employee says next: an
     * answer to a question about something missing, another document, or a
     * correction in their own words ("make it 250", "from Sunday instead").
     */
    public function revise(Request $request, RequestInterpreter $interpreter, InvoiceRiskChecker $risk): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(RequestCatalog::TYPES))],
            'fields' => ['nullable', 'array'],
            'invoice' => ['nullable', 'array'],
            'message' => ['nullable', 'string', 'max:2000', 'required_without:file'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'employeeId' => ['nullable', 'integer'],
        ], ['message.required_without' => 'Write your answer, or attach a document.']);

        $employee = $this->employeeFor($request, $data['employeeId'] ?? null);
        $type = $data['type'];
        $file = $request->file('file');
        $current = RequestCatalog::clean($type, $data['fields'] ?? []);
        $invoice = RequestCatalog::cleanInvoice($data['invoice'] ?? null);
        $notes = [];

        try {
            $proposal = $interpreter->revise($type, $current, $invoice, $data['message'] ?? null, $file, $this->known($employee));
        } catch (InterpreterUnavailable $down) {
            $proposal = (new RuleBasedRequestInterpreter)->revise($type, $current, $invoice, $data['message'] ?? null, $file);
            $notes[] = $this->fallbackNote($down, 'your answer');
        }

        // What the answer settles goes over the draft; whatever it does not
        // mention stays as it was. The kind of request does not change on an
        // answer - the AI has been seen to turn an advance "for school fees"
        // into an assistance request - only when the employee picks another.
        $newType = $type;
        $proposal['fields'] = [
            ...$current,
            // An option the employee named outright is taken even when the
            // AI was too cautious to pick it.
            ...$this->optionsNamed($newType, $data['message'] ?? null),
            ...array_filter($proposal['fields'], fn ($value) => $value !== null && $value !== ''),
        ];
        $proposal['invoice'] = ($proposal['invoice'] ?? null) ?: $invoice;

        return response()->json(['data' => $this->draft($newType, $proposal, null, $employee, $risk, $notes, (bool) $file)]);
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

        // What the advance is for, read from the explanation when the AI
        // left the list unanswered: "school fees" is plainly education.
        if ($type === 'salaryAdvance' && ($values['purpose'] ?? null) === null) {
            $values['purpose'] = RequestCatalog::purposeFrom($text.' '.($values['reason'] ?? ''));
        }

        $needsInvoice = in_array($type, RequestCatalog::INVOICE_TYPES, true);
        $invoice = $needsInvoice ? RequestCatalog::cleanInvoice($proposal['invoice'] ?? null) : null;

        if ($needsInvoice && ! $invoice) {
            $notes[] = $hasFile
                ? 'The attached document could not be read as an invoice. Attach a clear copy of the invoice (PDF or photo).'
                : 'This kind of request is made on an invoice. Attach the invoice and it will be read for you.';
        }

        $missing = RequestCatalog::missing($type, $values, $invoice !== null);

        return [
            'type' => $type,
            'typeLabel' => RequestCatalog::label($type),
            // Whether the last stage is a payment or an administrative action.
            'financial' => RequestCatalog::isFinancial($type),
            'confidence' => $proposal['confidence'],
            'summary' => $proposal['summary'],
            'engine' => $proposal['engine'],
            'fields' => array_map(fn ($field) => [...$field, 'value' => $values[$field['key']]], RequestCatalog::fields($type)),
            'missing' => $missing,
            // Asked of the employee one by one, instead of a form to fill in.
            'questions' => RequestCatalog::questions($type, $missing),
            // Taken from the record, so nobody is asked for it.
            'employee' => $this->employeeCard($employee, $type),
            'invoice' => $invoice,
            // The same checks management will see: duplicate invoice, repeated
            // medication, VAT that does not add up, an old invoice.
            'risk' => $invoice ? $risk->check($invoice, $type, $employee->id) : null,
            'notes' => $notes,
            'types' => $this->typeOptions(),
        ];
    }

    private function fallbackNote(InterpreterUnavailable $down, string $what): string
    {
        return ($down->getCode() === 429
            ? 'The AI usage limit has been reached for now'
            : 'The AI service could not be reached')
            .", so {$what} was read with basic rules. Please check every field.";
    }

    /** The listed options a message names word for word, by field. */
    private function optionsNamed(string $type, ?string $message): array
    {
        $plain = mb_strtolower((string) $message);
        $named = [];
        foreach (RequestCatalog::fields($type) as $field) {
            foreach ($field['options'] ?? [] as $option) {
                if ($plain !== '' && str_contains($plain, mb_strtolower($option))) {
                    $named[$field['key']] = $option;
                    break;
                }
            }
        }

        return $named;
    }

    /** Who the request is for and what the system already holds that bears on it. */
    private function employeeCard(Employee $employee, ?string $type = null): array
    {
        $omr = fn (float $amount) => number_format($amount, 3).' OMR';
        $year = (int) now()->format('Y');
        $facts = [['label' => 'Net Salary', 'value' => $omr($employee->netSalary())]];

        if ($type === 'salaryAdvance') {
            $facts[] = ['label' => 'Advance Available', 'value' => $omr(Eligibility::advanceLimit($employee))];
        } elseif ($type === 'loan') {
            $loan = Eligibility::loanSummary($employee);
            $facts[] = ['label' => 'Loan Limit Available', 'value' => $omr($loan['limit'])];
            if ($loan['openRequest']) {
                $facts[] = ['label' => 'Open Loan Request', 'value' => $loan['openRequest']];
            }
        } elseif ($type === 'assistance') {
            $facts[] = ['label' => 'Assistance Left This Year', 'value' => $omr(Eligibility::assistanceSummary($employee)['remaining'])];
        } elseif ($type === 'leave' || $type === 'leaveEncashment') {
            $balance = LeaveBalance::for($employee->id, 'Annual Leave', $year);
            $facts[] = ['label' => 'Annual Leave Left '.$year, 'value' => ($balance['remaining'] ?? 0).' days'];
        }

        return [
            'name' => $employee->displayName(),
            'employeeNo' => $employee->emp_no,
            'department' => $employee->department,
            'occupation' => $employee->occupation,
            'facts' => $facts,
        ];
    }

    /** The same, as plain lines for the AI to read. */
    private function known(Employee $employee): array
    {
        $year = (int) now()->format('Y');
        $balance = LeaveBalance::for($employee->id, 'Annual Leave', $year);

        return [
            'Net monthly salary: '.number_format($employee->netSalary(), 3, '.', '').' OMR',
            'Salary advance still available: '.number_format(Eligibility::advanceLimit($employee), 3, '.', '').' OMR',
            'Loan limit still available: '.number_format(Eligibility::loanLimit($employee), 3, '.', '').' OMR',
            'Annual leave days left in '.$year.': '.($balance['remaining'] ?? 0),
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
