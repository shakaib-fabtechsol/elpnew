<?php

namespace Tests\Feature;

/** The supplier directory: read-only, and it shows suppliers invoice claims registered. */
class SupplierTest extends ApiTestCase
{
    public function test_the_directory_lists_suppliers_with_their_numbers(): void
    {
        $this->as('admin')->getJson($this->api('suppliers?perPage=100'))
            ->assertOk()
            ->assertJsonCount(16, 'data')
            ->assertJsonPath('data.0.name', 'Al Maha Properties')
            ->assertJsonStructure(['data' => [['id', 'supplierNo', 'name', 'vatNumber', 'commercialRegistration', 'category', 'status', 'autoRegistered']]])
            ->assertJsonMissingPath('data.0.deletedAt');
    }

    public function test_a_supplier_registered_by_an_invoice_claim_is_listed(): void
    {
        $this->as('aisha')->postJson($this->api('entitlements'), [
            'kind' => 'medical',
            'invoice' => [
                'invoiceNo' => 'AN-55902', 'invoiceDate' => '2026-09-29', 'supplierName' => 'Al Nahda Hospital',
                'supplierVat' => 'OM1100778899', 'purpose' => 'Dental treatment',
                'items' => [['name' => 'Dental filling', 'quantity' => 2, 'amount' => 40]],
                'subtotal' => 80, 'vat' => 0, 'total' => 80,
            ],
            'confirmed' => true,
        ])->assertCreated();

        $this->as('admin')->getJson($this->api('suppliers?search=OM1100778899'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Al Nahda Hospital')
            ->assertJsonPath('data.0.autoRegistered', true);
    }

    public function test_the_directory_cannot_be_written(): void
    {
        $this->as('admin')->postJson($this->api('suppliers'), ['name' => 'X'])->assertStatus(405);
    }

    public function test_signing_in_is_required(): void
    {
        $this->getJson($this->api('suppliers'))->assertUnauthorized();
    }
}
