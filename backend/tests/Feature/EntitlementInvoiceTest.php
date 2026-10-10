<?php

namespace Tests\Feature;

use App\Models\EntitlementRequest;
use App\Models\Supplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/** Invoice-based requests: upload, AI reading (demo), checks, submit. */
class EntitlementInvoiceTest extends ApiTestCase
{
    private function invoice(array $overrides = []): array
    {
        return [
            'invoiceNo' => 'AN-55902', 'invoiceDate' => '2026-09-29', 'supplierName' => 'Al Nahda Hospital',
            'supplierVat' => 'OM1100778899', 'purpose' => 'Dental treatment',
            'items' => [['name' => 'Dental filling', 'quantity' => 2, 'amount' => 40], ['name' => 'Dental X-ray', 'quantity' => 1, 'amount' => 10]],
            'subtotal' => 90, 'vat' => 0, 'total' => 90,
            ...$overrides,
        ];
    }

    public function test_analysis_reads_the_invoice_and_flags_a_new_supplier(): void
    {
        Storage::fake('local');

        $this->as('aisha')->post($this->api('invoices/analyze'), [
            'file' => UploadedFile::fake()->create('scan.pdf', 120, 'application/pdf'),
            'kind' => 'medical',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.demo', true)
            ->assertJsonStructure(['data' => ['invoice' => ['invoiceNo', 'supplierName', 'supplierVat', 'items', 'subtotal', 'vat', 'total', 'confidence'], 'risk' => ['level', 'reasons', 'notes']]]);
    }

    public function test_a_file_named_dup_reads_as_a_duplicate_of_the_last_claim(): void
    {
        Storage::fake('local');

        $this->as('aisha')->post($this->api('invoices/analyze'), [
            'file' => UploadedFile::fake()->create('dup-invoice.pdf', 50, 'application/pdf'),
            'kind' => 'medical',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.risk.level', 'high')
            ->assertJsonPath('data.risk.duplicateOf', fn ($v) => in_array($v, ['MAR-006', 'ENT-008'], true));
    }

    public function test_submitting_registers_the_supplier_and_claims_total_less_insurance(): void
    {
        $this->assertNull(Supplier::where('vat_number', 'OM1100778899')->first());

        $this->as('aisha')->postJson($this->api('entitlements'), [
            'kind' => 'medical',
            'invoice' => $this->invoice(),
            'insuranceCovered' => 2,
            'confirmed' => true,
        ])->assertCreated()
            ->assertJsonPath('data.requestNo', 'MAR-009')
            ->assertJsonPath('data.amount', 88)
            ->assertJsonPath('data.risk.level', 'low')
            ->assertJsonPath('data.statusLabel', 'Pending');

        $supplier = Supplier::where('vat_number', 'OM1100778899')->firstOrFail();
        $this->assertTrue($supplier->auto_registered);
        $this->assertSame('Medical', $supplier->category);
    }

    public function test_same_invoice_number_twice_is_high_risk_for_management(): void
    {
        $this->as('aisha')->postJson($this->api('entitlements'), ['kind' => 'medical', 'invoice' => $this->invoice(), 'confirmed' => true])->assertCreated();

        $this->as('ahmed')->postJson($this->api('entitlements'), ['kind' => 'medical', 'invoice' => $this->invoice(), 'confirmed' => true])
            ->assertCreated()
            ->assertJsonPath('data.risk.level', 'high')
            ->assertJsonPath('data.risk.duplicateOf', 'MAR-009');
    }

    public function test_repeated_medication_and_bad_vat_and_old_invoice_are_flagged(): void
    {
        $response = $this->as('aisha')->postJson($this->api('entitlements'), [
            'kind' => 'medical',
            'invoice' => $this->invoice([
                'invoiceNo' => 'NEW-1', 'invoiceDate' => '2026-05-01',
                'items' => [['name' => 'Augmentin 625mg (20 tablets)', 'quantity' => 1, 'amount' => 10]],
                'subtotal' => 10, 'vat' => 1, 'total' => 11,
            ]),
            'confirmed' => true,
        ])->assertCreated()->assertJsonPath('data.risk.level', 'high');

        $reasons = implode(' | ', $response->json('data.risk.reasons'));
        $this->assertStringContainsString('Same medication claimed before', $reasons);
        $this->assertStringContainsString('VAT and total do not add up', $reasons);
        $this->assertStringContainsString('more than 90 days old', $reasons);
    }

    public function test_the_employee_must_confirm_the_reading(): void
    {
        $this->as('aisha')->postJson($this->api('entitlements'), ['kind' => 'medical', 'invoice' => $this->invoice()])
            ->assertUnprocessable()->assertJsonValidationErrors('confirmed');
    }

    public function test_overtime_is_worked_out_from_the_salary_not_typed(): void
    {
        // 1800 / 30 / 8 = 7.5 an hour; 10 hours = 75. A typed amount is ignored.
        $this->as('aisha')->postJson($this->api('entitlements'), ['kind' => 'overtime', 'period' => '2026-09', 'hours' => 10, 'amount' => 9999])
            ->assertCreated()
            ->assertJsonPath('data.requestNo', 'OTR-001')
            ->assertJsonPath('data.amount', 75);
    }

    public function test_approval_numbers_it_and_shows_awaiting_payment(): void
    {
        $id = EntitlementRequest::where('request_no', 'MAR-006')->value('id');

        $this->as('admin')->postJson($this->api("entitlements/$id/decision"), ['decision' => 'full'])
            ->assertOk()
            ->assertJsonPath('data.entitlementNo', 'ENT-009')
            ->assertJsonPath('data.statusLabel', 'Awaiting Payment');
    }

    public function test_paying_a_leave_encashment_files_it_on_the_leave_record(): void
    {
        // Ahmed has 30 - 10 = 20 annual days left in 2026.
        $id = $this->as('ahmed')->postJson($this->api('entitlements'), ['kind' => 'leaveEncashment', 'year' => 2026, 'leaveType' => 'Annual Leave', 'days' => 5])
            ->assertCreated()
            ->assertJsonPath('data.amount', 133.333)
            ->json('data.id');

        $this->as('admin')->postJson($this->api("entitlements/$id/decision"), ['decision' => 'full'])->assertOk();
        $this->as('accounts')->postJson($this->api("entitlements/$id/payment"), ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])->assertOk();

        $this->as('ahmed')->getJson($this->api('employees/3/leave-balance?type=Annual Leave&year=2026'))
            ->assertOk()
            ->assertJsonPath('data.types.0.balance.remaining', 15);
    }

    public function test_cannot_encash_more_days_than_are_left(): void
    {
        $this->as('aisha')->postJson($this->api('entitlements'), ['kind' => 'leaveEncashment', 'year' => 2026, 'leaveType' => 'Annual Leave', 'days' => 5])
            ->assertUnprocessable()->assertJsonValidationErrors('days');
    }
}
