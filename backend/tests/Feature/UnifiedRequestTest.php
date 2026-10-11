<?php

namespace Tests\Feature;

use App\Models\Supplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/** The unified request box: free text (and a document) -> a reviewed, real request. */
class UnifiedRequestTest extends ApiTestCase
{
    /** Switches the Gemini reader on and makes it answer with `$answer`. */
    private function gemini(array $answer, int $status = 200): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(
                ['candidates' => [['content' => ['parts' => [['text' => json_encode($answer)]]], 'finishReason' => 'STOP']]],
                $status,
            ),
        ]);
    }

    private function value(array $draft, string $key): mixed
    {
        return collect($draft['fields'])->firstWhere('key', $key)['value'] ?? null;
    }

    public function test_without_a_key_plain_rules_read_the_text_and_say_so(): void
    {
        Http::fake();

        $draft = $this->as('aisha')->postJson($this->api('requests/interpret'), ['text' => 'I need a salary advance of 300 OMR from my December salary for dental work'])
            ->assertOk()
            ->assertJsonPath('data.type', 'salaryAdvance')
            ->assertJsonPath('data.engine', 'rules')
            ->json('data');

        $this->assertSame(300.0, (float) $this->value($draft, 'amount'));
        $this->assertSame('December', $this->value($draft, 'deductMonth'));
        $this->assertSame('Medical Expenses', $this->value($draft, 'purpose')); // "dental work"
        $this->assertSame([], $draft['missing']);
        $this->assertStringContainsString('basic rules', $draft['notes'][0]);
        Http::assertNothingSent();
    }

    public function test_gemini_reads_a_leave_request_and_only_allowed_values_are_kept(): void
    {
        $this->gemini([
            'type' => 'leave', 'confidence' => 0.94, 'summary' => 'Annual leave from 1 to 5 November 2026 for a family visit.',
            'leaveType' => 'Annual Leave', 'fromDate' => '2026-11-01', 'toDate' => '2026-11-05', 'reason' => 'Family visit.',
            'purpose' => 'Something Invented', 'amount' => 999, // not fields of a leave: dropped
        ]);

        $draft = $this->as('ahmed')->postJson($this->api('requests/interpret'), ['text' => 'اريد اجازة سنوية من ١ الى ٥ نوفمبر لزيارة العائلة'])
            ->assertOk()
            ->assertJsonPath('data.type', 'leave')
            ->assertJsonPath('data.typeLabel', 'Leave')
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.missing', [])
            ->json('data');

        $this->assertSame('2026-11-01', $this->value($draft, 'fromDate'));
        $this->assertSame(['leaveType', 'fromDate', 'toDate', 'reason'], array_column($draft['fields'], 'key'));

        Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'test-key')
            && str_contains($request->url(), 'models/gemini-test:generateContent')
            && $request['generationConfig']['responseMimeType'] === 'application/json');
    }

    public function test_a_value_the_catalogue_does_not_allow_is_dropped_and_asked_for(): void
    {
        $this->gemini(['type' => 'salaryAdvance', 'confidence' => 0.9, 'summary' => 'x', 'amount' => 250, 'deductMonth' => 'Smarch', 'deductYear' => '2026', 'purpose' => 'Holiday']);

        $draft = $this->as('aisha')->postJson($this->api('requests/interpret'), ['text' => 'advance please'])->json('data');

        $this->assertNull($this->value($draft, 'deductMonth'));
        $this->assertNull($this->value($draft, 'purpose'));
        $this->assertEqualsCanonicalizing(['deductMonth', 'purpose'], $draft['missing']);
    }

    public function test_when_gemini_is_down_the_plain_reader_takes_over(): void
    {
        $this->gemini([], 503);

        $this->as('ahmed')->postJson($this->api('requests/interpret'), ['text' => 'I want a loan of 1200 OMR, 200 per month, starting November'])
            ->assertOk()
            ->assertJsonPath('data.type', 'loan')
            ->assertJsonPath('data.engine', 'rules')
            ->assertJsonPath('data.notes.0', 'The AI service could not be reached, so the request was read with basic rules. Please check every field.');
    }

    public function test_something_that_is_not_a_request_is_not_forced_into_one(): void
    {
        $this->gemini(['type' => 'unknown', 'confidence' => 0.2, 'summary' => 'This is a greeting, not a request.']);

        $this->as('aisha')->postJson($this->api('requests/interpret'), ['text' => 'hello'])
            ->assertOk()
            ->assertJsonPath('data.type', null)
            ->assertJsonCount(16, 'data.types');
    }

    public function test_text_or_a_document_is_required(): void
    {
        $this->as('aisha')->postJson($this->api('requests/interpret'), [])
            ->assertUnprocessable()->assertJsonValidationErrors('text');
    }

    public function test_submitting_creates_the_real_request_through_its_own_module(): void
    {
        $this->as('aisha')->postJson($this->api('requests/submit'), [
            'type' => 'salaryAdvance',
            'fields' => ['amount' => 300, 'deductMonth' => 'December', 'deductYear' => '2026', 'purpose' => 'Medical Expenses', 'reason' => 'Dental work.'],
        ])->assertCreated()
            ->assertJsonPath('data.typeLabel', 'Salary Advance')
            ->assertJsonPath('data.requestNo', 'SA-2026-00016')
            ->assertJsonPath('data.record.status', 'Pending')
            ->assertJsonPath('data.record.employee.name', 'Aisha Al Kindi');

        // It is on the module's own list, with its history started.
        $this->as('aisha')->getJson($this->api('salary-advances'))->assertJsonPath('data.0.requestNo', 'SA-2026-00016');
    }

    public function test_the_modules_own_limits_still_apply_and_point_at_the_review_field(): void
    {
        // Ahmed: 10 months of net salary is 9,040 OMR.
        $this->as('ahmed')->postJson($this->api('requests/submit'), [
            'type' => 'loan',
            'fields' => ['amount' => 20000, 'monthly' => 500, 'startMonth' => 'November 2026'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('amount'); // the module calls it loanAmount

        // Aisha has no annual leave left this year.
        $this->as('aisha')->postJson($this->api('requests/submit'), [
            'type' => 'leave',
            'fields' => ['leaveType' => 'Annual Leave', 'fromDate' => '2026-11-01', 'toDate' => '2026-11-03', 'reason' => 'Rest'],
        ])->assertUnprocessable()->assertJsonValidationErrors('toDate');
    }

    public function test_a_required_field_left_empty_is_refused_before_anything_is_created(): void
    {
        $this->as('aisha')->postJson($this->api('requests/submit'), ['type' => 'salaryAdvance', 'fields' => ['amount' => 300]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['deductMonth', 'deductYear', 'purpose']);
    }

    public function test_leave_overtime_and_a_grievance_are_created_from_their_fields(): void
    {
        $this->as('ahmed')->postJson($this->api('requests/submit'), [
            'type' => 'leave', 'fields' => ['leaveType' => 'Annual Leave', 'fromDate' => '2026-11-01', 'toDate' => '2026-11-05', 'reason' => 'Family visit.'],
        ])->assertCreated()->assertJsonPath('data.requestNo', 'LEV-016')->assertJsonPath('data.record.countedDays', 5);

        // 800 / 30 / 8 = 3.333 an hour; the server works the amount out.
        $this->as('ahmed')->postJson($this->api('requests/submit'), [
            'type' => 'overtime', 'fields' => ['period' => '2026-09', 'hours' => 10],
        ])->assertCreated()->assertJsonPath('data.requestNo', 'OTR-001')->assertJsonPath('data.record.amount', 33.33);

        $this->as('ahmed')->postJson($this->api('requests/submit'), [
            'type' => 'grievance', 'fields' => ['requestType' => 'Workload & Hours', 'reason' => 'Weekend duty three weeks running.'],
        ])->assertCreated()->assertJsonPath('data.requestNo', 'GRV-2026-004');
    }

    public function test_an_invoice_read_by_gemini_becomes_a_medical_claim_with_its_checks(): void
    {
        Storage::fake('local');
        $invoice = [
            'invoiceNo' => 'AN-55902', 'invoiceDate' => '2026-09-29', 'supplierName' => 'Al Nahda Hospital', 'supplierVat' => 'OM1100778899',
            'purpose' => 'Dental treatment',
            'items' => [['name' => 'Dental filling', 'quantity' => 2, 'amount' => 40], ['name' => 'Dental X-ray', 'quantity' => 1, 'amount' => 10]],
            'subtotal' => 90, 'vat' => 0, 'total' => 90,
        ];
        $this->gemini(['type' => 'medical', 'confidence' => 0.97, 'summary' => 'A dental invoice for 90 OMR.', 'invoice' => $invoice, 'reason' => 'Dental treatment.']);

        $draft = $this->as('aisha')->post($this->api('requests/interpret'), [
            'file' => UploadedFile::fake()->create('dental.pdf', 80, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.type', 'medical')
            ->assertJsonPath('data.invoice.total', 90)
            ->assertJsonPath('data.risk.level', 'low')
            ->assertJsonPath('data.missing', [])
            ->json('data');

        // The document itself went to Gemini.
        Http::assertSent(fn ($request) => ($request['contents'][0]['parts'][1]['inlineData']['mimeType'] ?? null) === 'application/pdf');

        $this->as('aisha')->post($this->api('requests/submit'), [
            'type' => 'medical',
            'fields' => ['insuranceCovered' => 5, 'reason' => 'Dental treatment.'],
            'invoice' => $draft['invoice'],
            'file' => UploadedFile::fake()->create('dental.pdf', 80, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.requestNo', 'MAR-009')
            ->assertJsonPath('data.record.amount', 85) // 90 less insurance
            ->assertJsonPath('data.record.risk.level', 'low');

        $this->assertTrue(Supplier::where('vat_number', 'OM1100778899')->firstOrFail()->auto_registered);

        // With nothing but the invoice - no field filled - it is still a claim.
        $this->as('ahmed')->post($this->api('requests/submit'), [
            'type' => 'medical',
            'invoice' => [...$draft['invoice'], 'invoiceNo' => 'AN-55903'],
            'file' => UploadedFile::fake()->create('dental.pdf', 80, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.record.amount', 90);
    }

    public function test_an_invoice_claim_without_a_readable_invoice_is_not_created(): void
    {
        $this->gemini(['type' => 'medical', 'confidence' => 0.8, 'summary' => 'A medical claim.', 'invoice' => null]);

        $this->as('aisha')->postJson($this->api('requests/interpret'), ['text' => 'please reimburse my pharmacy bill'])
            ->assertOk()->assertJsonPath('data.missing', ['invoice']);

        $this->as('aisha')->postJson($this->api('requests/submit'), ['type' => 'medical', 'fields' => ['reason' => 'x']])
            ->assertUnprocessable()->assertJsonValidationErrors('invoice');
    }

    public function test_an_employee_cannot_file_for_somebody_else(): void
    {
        // Aisha names Ahmed's record: it is filed as her own regardless.
        $this->as('aisha')->postJson($this->api('requests/submit'), [
            'type' => 'general', 'employeeId' => 3, 'fields' => ['requestType' => 'Suggestions', 'reason' => 'Move the review to Sunday.'],
        ])->assertCreated()->assertJsonPath('data.record.employee.name', 'Aisha Al Kindi');
    }

    public function test_what_is_missing_is_asked_for_and_the_record_is_not_asked_about(): void
    {
        Http::fake();

        $draft = $this->as('aisha')->postJson($this->api('requests/interpret'), ['text' => 'I need a salary advance of 300 OMR'])->json('data');

        $this->assertSame(['deductMonth', 'deductYear', 'purpose'], array_column($draft['questions'], 'key'));
        $this->assertSame('What is the advance for?', $draft['questions'][2]['question']);
        $this->assertContains('Emergency Case', $draft['questions'][2]['options']);
        $this->assertTrue($draft['financial']);
        $this->assertSame('Aisha Al Kindi', $draft['employee']['name']);
        $this->assertSame(['Net Salary', 'Advance Available'], array_column($draft['employee']['facts'], 'label'));
    }

    public function test_an_answer_fills_what_was_missing_and_keeps_the_rest(): void
    {
        Http::fake();

        // Without AI: the option and the month named in the answer are found.
        $this->as('aisha')->postJson($this->api('requests/revise'), [
            'type' => 'salaryAdvance', 'fields' => ['amount' => 300, 'reason' => 'Dental work.'],
            'message' => 'emergency case, take it from the December salary',
        ])->assertOk()
            ->assertJsonPath('data.fields.0.value', 300)
            ->assertJsonPath('data.fields.1.value', 'December')
            ->assertJsonPath('data.fields.3.value', 'Emergency Case')
            ->assertJsonPath('data.fields.4.value', 'Dental work.')
            ->assertJsonPath('data.missing', []);
    }

    public function test_an_option_named_outright_is_taken_even_when_the_ai_leaves_it_out(): void
    {
        $this->gemini(['type' => 'salaryAdvance', 'confidence' => 1, 'summary' => 'x', 'deductMonth' => 'December', 'deductYear' => '2026']);
        $this->as('aisha')->postJson($this->api('requests/revise'), [
            'type' => 'salaryAdvance', 'fields' => ['amount' => 300], 'message' => 'Emergency case, from the December salary',
        ])->assertOk()->assertJsonPath('data.fields.3.value', 'Emergency Case')->assertJsonPath('data.missing', []);
    }

    public function test_a_plain_correction_is_applied_without_ai(): void
    {
        Http::fake();
        $loan = ['amount' => 1200, 'monthly' => 200, 'startMonth' => 'November 2026'];

        $this->as('aisha')->postJson($this->api('requests/revise'), [
            'type' => 'salaryAdvance', 'fields' => ['amount' => 300, 'deductMonth' => 'December', 'deductYear' => '2026', 'purpose' => 'Emergency Case'], 'message' => 'make it 250',
        ])->assertOk()->assertJsonPath('data.fields.0.value', 250)->assertJsonPath('data.fields.1.value', 'December');

        // The figure the words name, not simply the first one.
        $this->as('ahmed')->postJson($this->api('requests/revise'), ['type' => 'loan', 'fields' => $loan, 'message' => 'change the monthly installment to 150'])
            ->assertOk()->assertJsonPath('data.fields.0.value', 1200)->assertJsonPath('data.fields.1.value', 150);
    }

    public function test_an_answer_does_not_turn_the_request_into_another_kind(): void
    {
        // Seen live: an advance "for school fees" came back as assistance.
        $this->gemini(['type' => 'assistance', 'confidence' => 1, 'summary' => 'x', 'assistanceType' => 'Education Assistance', 'reason' => 'For school fees.']);

        $this->as('aisha')->postJson($this->api('requests/revise'), [
            'type' => 'salaryAdvance', 'fields' => ['amount' => 300, 'deductMonth' => 'December', 'deductYear' => '2026'], 'message' => 'bachon ki school fees k liye',
        ])->assertOk()
            ->assertJsonPath('data.type', 'salaryAdvance')
            ->assertJsonPath('data.fields.3.value', 'Education Expenses')
            ->assertJsonPath('data.missing', []);
    }

    public function test_gemini_applies_a_correction_in_the_employees_words(): void
    {
        $this->gemini(['type' => 'leave', 'confidence' => 1, 'summary' => 'Annual leave from 8 to 12 November 2026.', 'fromDate' => '2026-11-08', 'toDate' => '2026-11-12']);

        $this->as('ahmed')->postJson($this->api('requests/revise'), [
            'type' => 'leave',
            'fields' => ['leaveType' => 'Annual Leave', 'fromDate' => '2026-11-01', 'toDate' => '2026-11-05', 'reason' => 'Family visit.'],
            'message' => 'move it one week later',
        ])->assertOk()
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.financial', false)
            ->assertJsonPath('data.fields.0.value', 'Annual Leave') // not mentioned: kept
            ->assertJsonPath('data.fields.1.value', '2026-11-08')
            ->assertJsonPath('data.fields.2.value', '2026-11-12')
            ->assertJsonPath('data.fields.3.value', 'Family visit.');

        // The draft and what the system knows went with the question.
        Http::assertSent(fn ($request) => str_contains($request['contents'][0]['parts'][0]['text'], '"fromDate":"2026-11-01"')
            && str_contains($request['contents'][0]['parts'][0]['text'], 'move it one week later')
            && str_contains($request['systemInstruction']['parts'][0]['text'], 'Net monthly salary'));
    }

    public function test_choosing_the_type_by_hand_gives_that_types_fields(): void
    {
        $this->as('aisha')->postJson($this->api('requests/retype'), ['type' => 'loan', 'fields' => ['amount' => 500, 'reason' => 'Car repair']])
            ->assertOk()
            ->assertJsonPath('data.type', 'loan')
            ->assertJsonPath('data.fields.0.value', 500)
            ->assertJsonPath('data.missing', ['monthly', 'startMonth']);
    }
}
