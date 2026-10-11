<?php

namespace Tests\Feature;

use App\Services\Ai\GeminiClient;
use App\Services\Ai\Schema;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/** What the AI model reads outside the request box: invoices, request histories, search questions. */
class AiFeaturesTest extends ApiTestCase
{
    /** Switches OpenAI on and makes it answer with `$answer`. */
    private function openai(array $answer, int $status = 200): void
    {
        config(['services.openai.key' => 'test-openai-key', 'services.openai.model' => 'gpt-test']);
        Http::fake([
            'api.openai.com/*' => Http::response(
                ['choices' => [['message' => ['role' => 'assistant', 'content' => json_encode($answer)], 'finish_reason' => 'stop']]],
                $status,
            ),
        ]);
    }

    private function invoice(array $overrides = []): array
    {
        return [
            'isInvoice' => true, 'invoiceNo' => 'PH-2026-4471', 'invoiceDate' => '2026-10-08',
            'supplierName' => 'Al Shifa Pharmacy LLC', 'supplierVat' => 'OM1100987654', 'supplierCr' => null, 'supplierPhone' => null,
            'supplierCategory' => 'Medical', 'purpose' => 'Medication and dental consultation',
            'items' => [['name' => 'Amoxicillin 500mg', 'quantity' => 2, 'amount' => 4.5], ['name' => 'Dental consultation', 'quantity' => 1, 'amount' => 30]],
            'subtotal' => 39, 'vat' => 0, 'total' => 39,
            'confidence' => ['invoiceNo' => 99, 'supplier' => 97, 'amount' => 98, 'vat' => 95, 'purpose' => 90, 'date' => 140],
            ...$overrides,
        ];
    }

    /* ------------------------------------------------------- invoices */

    public function test_with_a_key_the_invoice_is_read_by_ai_and_not_by_the_demo(): void
    {
        $this->openai($this->invoice());

        $this->as('aisha')->post($this->api('invoices/analyze'), [
            'file' => UploadedFile::fake()->create('bill.pdf', 120, 'application/pdf'),
            'kind' => 'medical',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.demo', false)
            ->assertJsonPath('data.invoice.invoiceNo', 'PH-2026-4471')
            ->assertJsonPath('data.invoice.supplierName', 'Al Shifa Pharmacy LLC')
            ->assertJsonPath('data.invoice.total', 39)
            ->assertJsonPath('data.invoice.items.0.quantity', 2)
            ->assertJsonPath('data.invoice.fileName', 'bill.pdf')
            // A confidence the model overstates is held to 100.
            ->assertJsonPath('data.invoice.confidence.date', 100)
            ->assertJsonPath('data.risk.level', 'low');

        // The file itself went to the model.
        Http::assertSent(fn ($request) => ($request['messages'][1]['content'][1]['type'] ?? null) === 'file');
    }

    public function test_a_file_that_is_not_an_invoice_is_refused_not_filled_in(): void
    {
        $this->openai($this->invoice(['isInvoice' => false, 'invoiceNo' => null, 'supplierName' => null, 'items' => [], 'total' => null]));

        $this->as('aisha')->post($this->api('invoices/analyze'), [
            'file' => UploadedFile::fake()->image('holiday.jpg'),
            'kind' => 'medical',
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_when_the_ai_is_over_its_limit_the_employee_is_told_to_try_again(): void
    {
        $this->openai([], 429);

        $this->as('aisha')->post($this->api('invoices/analyze'), [
            'file' => UploadedFile::fake()->create('bill.pdf', 120, 'application/pdf'),
            'kind' => 'medical',
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('errors.file.0', 'The AI usage limit has been reached for now. Please try again in a few minutes.');
    }

    /* ------------------------------------------------------- overview */

    private function overview(array $overrides = []): array
    {
        return [
            'kind' => 'Salary Advance', 'measure' => 'money',
            'history' => [
                ['date' => '2026-06-01', 'amount' => 300, 'status' => 'Approved', 'type' => 'Education Expenses'],
                ['date' => '2026-08-01', 'amount' => 500, 'status' => 'Rejected', 'type' => 'Other'],
            ],
            'facts' => ['remaining' => 400, 'netSalary' => 2034],
            ...$overrides,
        ];
    }

    public function test_the_overview_is_read_by_ai_and_held_to_what_policy_leaves(): void
    {
        $this->openai([
            'recommended' => 900, 'recommendedReason' => 'In line with your approved advance.',
            'probability' => 130, 'probabilityReason' => 'One approved and one rejected request.',
            'insights' => ['You were approved for 300 OMR in June.', 'A request for 500 OMR was rejected in August.', 'Third.', 'Fourth.'],
        ]);

        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview())
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.engine', 'openai')
            // 900 was suggested; only 400 is left.
            ->assertJsonPath('data.recommended', 400)
            ->assertJsonPath('data.probability', 100)
            ->assertJsonCount(3, 'data.insights');

        // The policy figures and the history went with the question.
        Http::assertSent(fn ($request) => str_contains($request['messages'][1]['content'][0]['text'], '"remaining":400')
            && str_contains($request['messages'][1]['content'][0]['text'], 'Education Expenses'));
    }

    public function test_the_same_history_is_only_paid_for_once_a_day(): void
    {
        $this->openai(['recommended' => 300, 'recommendedReason' => 'x', 'probability' => 60, 'probabilityReason' => 'y', 'insights' => ['z']]);

        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview())->assertOk();
        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview())->assertOk()->assertJsonPath('data.recommended', 300);

        Http::assertSentCount(1);
    }

    public function test_with_no_ai_the_screen_keeps_its_own_figures(): void
    {
        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview())
            ->assertOk()->assertJsonPath('data.available', false);
    }

    public function test_a_list_with_no_requests_yet_is_still_read_from_policy(): void
    {
        $this->openai([
            'recommended' => 200, 'recommendedReason' => 'A first request, well within the 400 OMR remaining.',
            'probability' => 55, 'probabilityReason' => 'Nothing has been decided yet; this rests on policy alone.',
            'insights' => ['You have not made a salary advance request yet.'],
        ]);

        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview(['history' => []]))
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.recommended', 200)
            ->assertJsonPath('data.probability', 55)
            ->assertJsonPath('data.insights.0', 'You have not made a salary advance request yet.');

        Http::assertSent(fn ($request) => str_contains($request['messages'][1]['content'][0]['text'], '"history":[]'));
    }

    public function test_when_the_ai_is_down_the_overview_says_it_is_not_available(): void
    {
        $this->openai([], 503);

        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview())
            ->assertOk()->assertJsonPath('data.available', false);
    }

    public function test_days_and_counts_are_given_no_suggested_sum(): void
    {
        $this->openai(['recommended' => 5, 'recommendedReason' => 'x', 'probability' => 70, 'probabilityReason' => 'y', 'insights' => []]);

        $this->as('aisha')->postJson($this->api('ai/overview'), $this->overview(['measure' => 'days']))
            ->assertOk()->assertJsonPath('data.recommended', null)->assertJsonPath('data.probability', 70);
    }

    /* --------------------------------------------------------- search */

    public function test_a_question_becomes_a_query_and_no_record_is_sent(): void
    {
        $this->openai(['query' => 'department:"Legal Services" salary>1000 secret:x -status:Inactive', 'explanation' => 'Active legal staff earning over 1,000 OMR.']);

        $this->as('admin')->postJson($this->api('ai/search'), [
            'question' => 'active people in legal earning more than 1000',
            'fields' => [
                ['key' => 'department', 'kind' => 'text', 'values' => ['Legal Services', 'Administration']],
                ['key' => 'salary', 'kind' => 'number'],
                ['key' => 'status', 'kind' => 'text', 'values' => ['Active', 'Inactive']],
            ],
        ])->assertOk()
            ->assertJsonPath('data.available', true)
            // "secret" is not a column of this list: it is searched as a word, not as a field.
            ->assertJsonPath('data.query', 'department:"Legal Services" salary>1000 x -status:Inactive')
            ->assertJsonPath('data.explanation', 'Active legal staff earning over 1,000 OMR.');

        Http::assertSent(fn ($request) => str_contains($request['messages'][1]['content'][0]['text'], 'active people in legal')
            && ! str_contains($request['messages'][1]['content'][0]['text'], 'Aisha'));
    }

    public function test_search_without_ai_says_so_and_needs_a_sign_in(): void
    {
        $this->as('admin')->postJson($this->api('ai/search'), ['question' => 'expired passports', 'fields' => []])
            ->assertOk()->assertJsonPath('data.available', false);

        $this->app['auth']->forgetGuards();
        $this->postJson($this->api('ai/search'), ['question' => 'x', 'fields' => []])->assertUnauthorized();
        $this->postJson($this->api('ai/overview'), $this->overview())->assertUnauthorized();
    }

    /* ------------------------------------------------------- dialects */

    public function test_the_same_schema_is_written_in_geminis_dialect(): void
    {
        $schema = GeminiClient::dialect(Schema::object([
            'name' => Schema::string(),
            'kind' => Schema::string(nullable: true, enum: ['a', 'b']),
            'lines' => Schema::list(Schema::object(['amount' => Schema::number()])),
        ]));

        $this->assertSame('OBJECT', $schema['type']);
        $this->assertSame(['name', 'lines'], $schema['required']);
        $this->assertSame(['type' => 'STRING', 'nullable' => true, 'enum' => ['a', 'b']], $schema['properties']['kind']);
        $this->assertSame('NUMBER', $schema['properties']['lines']['items']['properties']['amount']['type']);
        $this->assertArrayNotHasKey('additionalProperties', $schema);
    }
}
