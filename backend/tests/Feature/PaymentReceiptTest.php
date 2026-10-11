<?php

namespace Tests\Feature;

use App\Http\Requests\Workflow\PaymentRequest;
use App\Models\SalaryAdvance;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/** The payment step: the methods the screens offer, and the transfer receipt kept with the payment. */
class PaymentReceiptTest extends ApiTestCase
{
    /** SA-2026-00013 is approved and waiting to be paid. */
    private function approved(): int
    {
        return SalaryAdvance::where('request_no', 'SA-2026-00013')->value('id');
    }

    public function test_every_method_the_screens_offer_is_accepted(): void
    {
        $this->assertSame(['Bank Transfer', 'Cheque', 'Cash', 'Card', 'Direct Debit'], PaymentRequest::METHODS);

        $this->as('accounts')->postJson($this->api('salary-advances/'.$this->approved().'/payment'), [
            'paymentMethod' => 'Direct Debit', 'paymentDate' => '2026-10-09', 'paymentReference' => 'DD-1',
        ])->assertOk()->assertJsonPath('data.paymentMethod', 'Direct Debit');
    }

    public function test_a_card_payment_needs_a_reference_and_an_unknown_method_is_refused(): void
    {
        $url = $this->api('salary-advances/'.$this->approved().'/payment');

        $this->as('accounts')->postJson($url, ['paymentMethod' => 'Card', 'paymentDate' => '2026-10-09'])
            ->assertUnprocessable()->assertJsonValidationErrors('paymentReference');

        $this->as('accounts')->postJson($url, ['paymentMethod' => 'Crypto', 'paymentDate' => '2026-10-09', 'paymentReference' => 'X'])
            ->assertUnprocessable()->assertJsonValidationErrors('paymentMethod');

        // Cash still leaves no reference behind.
        $this->as('accounts')->postJson($url, ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])->assertOk();
    }

    public function test_the_receipt_is_stored_with_the_payment_and_can_be_downloaded(): void
    {
        Storage::fake('local');
        $id = $this->approved();

        $this->as('accounts')->post($this->api("salary-advances/$id/payment"), [
            'paymentMethod' => 'Bank Transfer', 'paymentDate' => '2026-10-09', 'paymentReference' => 'TRX-9',
            'receipt' => UploadedFile::fake()->create('transfer-slip.pdf', 120, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Paid')
            ->assertJsonPath('data.paymentReceiptName', 'transfer-slip.pdf')
            ->assertJsonMissingPath('data.paymentReceipt');

        $path = SalaryAdvance::find($id)->payment_receipt;
        $this->assertNotNull($path);
        Storage::disk('local')->assertExists($path);

        // The employee it was paid to may see it; a colleague may not.
        $this->as('aisha')->get($this->api("salary-advances/$id/receipt"))
            ->assertOk()->assertDownload('transfer-slip.pdf');
        $this->as('ahmed')->get($this->api("salary-advances/$id/receipt"), ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_a_payment_without_a_receipt_has_none_to_download(): void
    {
        $id = $this->approved();

        $this->as('accounts')->postJson($this->api("salary-advances/$id/payment"), ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])
            ->assertOk()->assertJsonPath('data.paymentReceiptName', null);

        $this->as('accounts')->getJson($this->api("salary-advances/$id/receipt"))->assertNotFound();
    }

    public function test_a_receipt_must_be_a_pdf_or_an_image_and_is_not_kept_when_the_payment_is_refused(): void
    {
        Storage::fake('local');

        $this->as('accounts')->post($this->api('salary-advances/'.$this->approved().'/payment'), [
            'paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09',
            'receipt' => UploadedFile::fake()->create('slip.exe', 20, 'application/octet-stream'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('receipt');

        // SA-2026-00012 is still pending: the payment is refused, so its receipt is thrown away.
        $pending = SalaryAdvance::where('request_no', 'SA-2026-00012')->value('id');
        $this->as('accounts')->post($this->api("salary-advances/$pending/payment"), [
            'paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09',
            'receipt' => UploadedFile::fake()->create('slip.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('status');

        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_salary_transfer_keeps_its_receipt(): void
    {
        Storage::fake('local');
        $id = $this->as('accounts')->postJson($this->api('salaries'), ['employeeId' => 7, 'month' => 10, 'year' => 2026])
            ->assertCreated()->json('data.id');

        $this->as('accounts')->post($this->api("salaries/$id/transfer"), [
            'paymentMethod' => 'Bank Transfer', 'paymentDate' => '2026-10-09', 'paymentReference' => 'TRX-S',
            'receipt' => UploadedFile::fake()->image('slip.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.paymentReceiptName', 'slip.jpg')
            ->assertJsonMissingPath('data.paymentReceipt');

        $this->as('accounts')->get($this->api("salaries/$id/receipt"))->assertOk()->assertDownload('slip.jpg');
    }
}
