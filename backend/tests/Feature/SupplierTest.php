<?php

namespace Tests\Feature;

use App\Models\Supplier;

/** The supplier directory: read by everyone, written by management, and it shows suppliers invoice claims registered. */
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

    public function test_management_adds_a_supplier_and_it_is_numbered(): void
    {
        $id = $this->as('admin')->postJson($this->api('suppliers'), [
            'name' => 'Seeb Office Furniture', 'category' => 'Office Supplies',
            'commercialRegistration' => '1998877', 'taxIdentificationNumber' => 'TIN-55120', 'vatNumber' => 'OM1100990011',
            'bank' => 'Bank Muscat', 'accountNumber' => '0331 0098 7765', 'phone' => '+968 9911 2233',
        ])->assertCreated()
            ->assertJsonPath('data.supplierNo', 'SUP-017')
            ->assertJsonPath('data.status', 'Active')
            ->assertJsonPath('data.autoRegistered', false)
            ->assertJsonPath('data.taxIdentificationNumber', 'TIN-55120')
            ->assertJsonPath('data.accountNumber', '0331 0098 7765')
            ->json('data.id');

        $this->as('aisha')->getJson($this->api('suppliers?search=Seeb'))->assertOk()->assertJsonPath('data.0.id', $id);
    }

    public function test_management_changes_only_what_is_sent(): void
    {
        $supplier = Supplier::where('name', 'Al Maha Properties')->firstOrFail();

        $this->as('admin')->patchJson($this->api("suppliers/$supplier->id"), ['status' => 'Inactive', 'phone' => '+968 2444 0000'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Inactive')
            ->assertJsonPath('data.phone', '+968 2444 0000')
            ->assertJsonPath('data.name', 'Al Maha Properties')
            ->assertJsonPath('data.supplierNo', $supplier->supplier_no);

        // Saving a supplier with its own numbers unchanged is not a clash with itself.
        $this->as('admin')->patchJson($this->api("suppliers/$supplier->id"), ['vatNumber' => $supplier->vat_number, 'commercialRegistration' => $supplier->commercial_registration])
            ->assertOk();
    }

    public function test_a_supplier_needs_a_name_a_category_and_numbers_of_its_own(): void
    {
        $taken = Supplier::whereNotNull('vat_number')->whereNotNull('commercial_registration')->firstOrFail();

        $this->as('admin')->postJson($this->api('suppliers'), ['status' => 'Closed'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'category', 'status']);

        $this->as('admin')->postJson($this->api('suppliers'), [
            'name' => 'Copycat Trading', 'category' => 'Other',
            'vatNumber' => $taken->vat_number, 'commercialRegistration' => $taken->commercial_registration,
        ])->assertUnprocessable()->assertJsonValidationErrors(['vatNumber', 'commercialRegistration']);

        // Two suppliers may both have no tax number.
        $this->as('admin')->postJson($this->api('suppliers'), ['name' => 'Corner Kiosk', 'category' => 'Other'])->assertCreated();
        $this->as('admin')->postJson($this->api('suppliers'), ['name' => 'Second Kiosk', 'category' => 'Other', 'vatNumber' => ''])->assertCreated();
    }

    public function test_only_management_writes_the_directory(): void
    {
        $id = Supplier::value('id');

        $this->as('aisha')->postJson($this->api('suppliers'), ['name' => 'X', 'category' => 'Other'])->assertForbidden();
        $this->as('accounts')->patchJson($this->api("suppliers/$id"), ['status' => 'Inactive'])->assertForbidden();
    }

    public function test_signing_in_is_required(): void
    {
        $this->getJson($this->api('suppliers'))->assertUnauthorized();
    }
}
