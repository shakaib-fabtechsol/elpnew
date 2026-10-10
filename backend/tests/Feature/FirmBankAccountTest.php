<?php

namespace Tests\Feature;

class FirmBankAccountTest extends ApiTestCase
{
    public function test_everyone_reads_the_accounts_payments_leave_from(): void
    {
        $this->as('aisha')->getJson($this->api('bank-accounts'))
            ->assertOk()
            ->assertJsonCount(6, 'data')
            ->assertJsonPath('data.0.bankName', 'Bank Muscat')
            ->assertJsonPath('data.0.accountNumber', '0123456789')
            ->assertJsonPath('data.2.active', false);
    }

    public function test_management_adds_and_closes_an_account(): void
    {
        $id = $this->as('admin')->postJson($this->api('bank-accounts'), [
            'bankName' => 'Bank Nizwa', 'accountName' => 'Reserve Account', 'accountNumber' => '5566778899',
            'iban' => 'om11 bnzw 5566 7788 9900', 'swift' => 'bnzwomrx', 'openingBalance' => 1000,
        ])->assertCreated()
            ->assertJsonPath('data.iban', 'OM11 BNZW 5566 7788 9900')
            ->assertJsonPath('data.active', true)
            ->json('data.id');

        $this->as('admin')->patchJson($this->api("bank-accounts/$id"), ['active' => false])
            ->assertOk()->assertJsonPath('data.active', false);
    }

    public function test_a_duplicate_or_misshapen_number_is_refused_and_only_management_adds(): void
    {
        $this->as('admin')->postJson($this->api('bank-accounts'), ['bankName' => 'X', 'accountName' => 'Y', 'accountNumber' => '0123456789'])
            ->assertUnprocessable()->assertJsonValidationErrors('accountNumber');

        $this->as('admin')->postJson($this->api('bank-accounts'), ['bankName' => 'X', 'accountName' => 'Y', 'accountNumber' => '12'])
            ->assertUnprocessable()->assertJsonValidationErrors('accountNumber');

        $this->as('accounts')->postJson($this->api('bank-accounts'), ['bankName' => 'X', 'accountName' => 'Y', 'accountNumber' => '998877665544'])
            ->assertForbidden();
    }
}
