<?php

namespace Tests\Feature;

use App\Models\EmployeeAsset;
use App\Services\Permissions\PermissionCatalog;

/** Assigned Assets: equipment issued to an employee, then returned or disposed of. */
class EmployeeAssetTest extends ApiTestCase
{
    private const AHMED = 3;   // lawyer; the demo issues him a laptop, a phone and an ID card

    private const AISHA = 7;   // lawyer

    private const SARAH = 4;   // no assets in the demo

    private function laptop(array $over = []): array
    {
        return [...['type' => 'Computer / Laptop', 'assetNumber' => 'AST-IT-00900', 'makeModel' => 'Dell Latitude 5450', 'serialNumber' => 'SN-1', 'issueDate' => '2026-10-01'], ...$over];
    }

    public function test_an_asset_is_issued_and_listed_on_the_register(): void
    {
        $issued = $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop())
            ->assertCreated()
            ->assertJsonPath('data.employeeId', self::SARAH)
            ->assertJsonPath('data.type', 'Computer / Laptop')
            ->assertJsonPath('data.assetNumber', 'AST-IT-00900')
            ->assertJsonPath('data.makeModel', 'Dell Latitude 5450')
            ->assertJsonPath('data.issueDate', '2026-10-01')
            ->assertJsonPath('data.returnDate', null)
            ->assertJsonPath('data.status', 'Assigned')
            ->assertJsonPath('data.recordedByName', 'Mohammed Al Yahyaei')
            ->json('data');

        $this->as('admin')->getJson($this->api('employees/'.self::SARAH.'/assets'))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $issued['id']);

        $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), ['type' => 'Boat'])
            ->assertUnprocessable()->assertJsonValidationErrors(['type', 'assetNumber', 'issueDate']);
    }

    public function test_returning_and_disposing_keep_the_history(): void
    {
        $id = $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop())->json('data.id');
        $path = $this->api('employees/'.self::SARAH.'/assets/'.$id);

        $this->as('admin')->patchJson($path, ['action' => 'return', 'returnDate' => '2026-09-01'])
            ->assertUnprocessable()->assertJsonValidationErrors('returnDate');   // before it was issued
        $this->as('admin')->patchJson($path, ['action' => 'return', 'returnDate' => '2026-10-08'])
            ->assertOk()->assertJsonPath('data.status', 'Returned')->assertJsonPath('data.returnDate', '2026-10-08');
        $this->as('admin')->patchJson($path, ['action' => 'return', 'returnDate' => '2026-10-08'])->assertUnprocessable();

        // A returned laptop may still be written off later.
        $this->as('admin')->patchJson($path, ['action' => 'dispose', 'disposalDate' => '2026-10-09'])
            ->assertOk()->assertJsonPath('data.status', 'Disposed')
            ->assertJsonPath('data.returnDate', '2026-10-08')->assertJsonPath('data.disposalDate', '2026-10-09');

        $this->as('admin')->deleteJson($path)->assertStatus(405);
        $this->assertDatabaseHas('employee_assets', ['id' => $id, 'status' => 'Disposed']);
    }

    public function test_details_can_be_corrected(): void
    {
        $id = $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop())->json('data.id');

        $this->as('admin')->patchJson($this->api('employees/'.self::SARAH.'/assets/'.$id), ['makeModel' => 'Dell Latitude 7450', 'serialNumber' => 'SN-2'])
            ->assertOk()->assertJsonPath('data.makeModel', 'Dell Latitude 7450')->assertJsonPath('data.status', 'Assigned');
    }

    public function test_one_asset_number_cannot_be_assigned_to_two_people_at_once(): void
    {
        // AST-IT-00428 is out with Ahmed in the demo.
        $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop(['assetNumber' => 'ast-it-00428']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.assetNumber.0', fn ($message) => str_contains($message, 'Ahmed Al Balushi'));

        $held = EmployeeAsset::where('asset_number', 'AST-IT-00428')->value('id');
        $this->as('admin')->patchJson($this->api('employees/'.self::AHMED.'/assets/'.$held), ['action' => 'return', 'returnDate' => '2026-10-09'])->assertOk();

        // Back in the store, it can go to somebody else.
        $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop(['assetNumber' => 'AST-IT-00428']))->assertCreated();
    }

    public function test_an_employee_sees_their_own_register_but_nobody_elses(): void
    {
        $this->as('ahmed')->getJson($this->api('employees/'.self::AHMED.'/assets'))
            ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('data.0.status', 'Assigned');
        $this->as('ahmed')->getJson($this->api('employees/'.self::AISHA.'/assets'))->assertForbidden();
    }

    public function test_only_those_allowed_issue_or_close_assets(): void
    {
        $this->as('ahmed')->postJson($this->api('employees/'.self::AHMED.'/assets'), $this->laptop())->assertForbidden();
        $held = EmployeeAsset::where('asset_number', 'AST-IT-00428')->value('id');
        $this->as('ahmed')->patchJson($this->api('employees/'.self::AHMED.'/assets/'.$held), ['action' => 'return', 'returnDate' => '2026-10-09'])->assertForbidden();

        // Given the permission and the reach, a non-admin can.
        $this->as('admin')->putJson($this->api('employees/'.self::AISHA.'/permissions'), [
            'template' => 'lawyer', 'scope' => 'all', 'departments' => [], 'approvalLimit' => null, 'paymentLimit' => null,
            'grants' => [...PermissionCatalog::template('lawyer')['grants'], 'employeeAssets.view', 'employeeAssets.create'],
        ])->assertOk();
        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED.'/assets'))->assertOk();
        $this->as('aisha')->postJson($this->api('employees/'.self::SARAH.'/assets'), $this->laptop())->assertCreated();
        $this->as('aisha')->patchJson($this->api('employees/'.self::AHMED.'/assets/'.$held), ['action' => 'return', 'returnDate' => '2026-10-09'])->assertForbidden();
    }

    public function test_the_admin_template_holds_the_asset_permissions(): void
    {
        $this->assertContains('employeeAssets.edit', PermissionCatalog::template('admin')['grants']);
        $this->assertNotContains('employeeAssets.create', PermissionCatalog::template('staff')['grants']);
    }
}
