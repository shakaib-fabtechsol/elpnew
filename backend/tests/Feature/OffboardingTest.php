<?php

namespace Tests\Feature;

use App\Models\EmployeeAsset;
use App\Models\EmployeePermission;
use App\Models\Offboarding;
use App\Models\PermissionDelegation;
use App\Models\User;
use App\Services\Permissions\PermissionCatalog;

/** Employee Offboarding: End of Service as its own process, from notice to Inactive. */
class OffboardingTest extends ApiTestCase
{
    private const AHMED = 3;   // lawyer with a login; the demo issues him a laptop, a phone and an ID card

    private const SARAH = 4;   // no assets in the demo

    private function start(int $employee = self::AHMED, array $over = []): array
    {
        return $this->as('admin')->postJson($this->api('offboardings'), [...[
            'employeeId' => $employee,
            'type' => 'Termination',
            'reason' => 'Restructuring',
            'details' => 'Role made redundant.',
            'noticeDate' => '2026-10-09',
            'noticeDays' => 30,
            'noticeMode' => 'Paid in lieu',
            'lastWorkingDate' => '2026-10-20',
        ], ...$over])->assertCreated()->json('data');
    }

    private function clearChecklist(array $case): void
    {
        foreach ($case['tasks'] as $task) {
            $this->as('admin')->patchJson($this->api('offboardings/'.$case['id'].'/tasks/'.$task['id']), ['status' => 'Done'])->assertOk();
        }
    }

    public function test_the_permission_module_is_in_the_catalogue_and_admin_holds_it(): void
    {
        foreach (['view', 'create', 'edit', 'approve'] as $action) {
            $this->assertContains('offboarding.'.$action, PermissionCatalog::keys());
            $this->assertContains('offboarding.'.$action, PermissionCatalog::template('admin')['grants']);
        }
        $this->assertNotContains('offboarding.view', PermissionCatalog::template('lawyer')['grants']);
    }

    public function test_a_case_is_initiated_with_its_checklist_and_waits_for_approval(): void
    {
        $case = $this->start();

        $this->assertMatchesRegularExpression('/^OFF-2026-\d{3}$/', $case['caseNo']);
        $this->assertSame('Pending Approval', $case['status']);
        $this->assertSame('Company', $case['initiatedByParty']);
        $this->assertSame('Management Decision', $case['decisionMaker']);
        $this->assertCount(12, $case['tasks']);
        $this->assertSame(3, $case['assetsOutstanding']);
        $this->assertSame(11, $case['noticeDaysRemaining']);
        // 30 days' notice, 11 served, 19 paid in lieu at the daily gross rate.
        $this->assertSame(19, $case['settlementEstimate']['noticeDaysUnserved']);
        $this->assertGreaterThan(0, $case['settlementEstimate']['noticePay']);
        $this->assertContains('The case has not been approved yet.', $case['blockers']);

        // One open case per employee; the last day cannot come before the notice.
        $this->as('admin')->postJson($this->api('offboardings'), ['employeeId' => self::AHMED, 'type' => 'Resignation', 'noticeDate' => '2026-10-09', 'noticeDays' => 30, 'noticeMode' => 'Served', 'lastWorkingDate' => '2026-11-08'])
            ->assertUnprocessable()->assertJsonValidationErrors('employeeId');
        $this->as('admin')->postJson($this->api('offboardings'), ['employeeId' => self::SARAH, 'type' => 'Resignation', 'noticeDate' => '2026-10-09', 'noticeDays' => 30, 'noticeMode' => 'Served', 'lastWorkingDate' => '2026-10-01'])
            ->assertUnprocessable()->assertJsonValidationErrors('lastWorkingDate');
        // An employee who has already left is not offboarded twice.
        $this->as('admin')->postJson($this->api('offboardings'), ['employeeId' => 5, 'type' => 'Termination', 'noticeDate' => '2026-10-09', 'noticeDays' => 0, 'noticeMode' => 'Waived', 'lastWorkingDate' => '2026-10-09'])
            ->assertUnprocessable()->assertJsonValidationErrors('employeeId');

        $this->as('admin')->getJson($this->api('offboardings'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.employee.name', 'Ahmed Al Balushi');
    }

    public function test_only_management_terminates_but_an_employee_may_resign(): void
    {
        $this->as('ahmed')->postJson($this->api('offboardings'), ['employeeId' => self::SARAH, 'type' => 'Termination', 'noticeDate' => '2026-10-09', 'noticeDays' => 30, 'noticeMode' => 'Served', 'lastWorkingDate' => '2026-11-08'])
            ->assertForbidden();
        $this->as('ahmed')->postJson($this->api('offboardings'), ['employeeId' => self::AHMED, 'type' => 'Termination', 'noticeDate' => '2026-10-09', 'noticeDays' => 30, 'noticeMode' => 'Served', 'lastWorkingDate' => '2026-11-08'])
            ->assertForbidden();

        $resignation = $this->as('ahmed')->postJson($this->api('offboardings'), ['employeeId' => self::AHMED, 'type' => 'Resignation', 'reason' => 'Better Opportunity', 'noticeDate' => '2026-10-09', 'noticeDays' => 30, 'noticeMode' => 'Served', 'lastWorkingDate' => '2026-11-08'])
            ->assertCreated()->assertJsonPath('data.decisionMaker', 'Employee Decision')->json('data');

        // He sees his own case, nobody else's, and cannot approve it.
        $this->as('ahmed')->getJson($this->api('offboardings'))->assertOk()->assertJsonCount(1, 'data');
        $this->as('ahmed')->postJson($this->api('offboardings/'.$resignation['id'].'/decision'), ['decision' => 'approve'])->assertForbidden();
        $this->as('aisha')->getJson($this->api('offboardings/'.$resignation['id']))->assertForbidden();

        // ...and may withdraw it while it waits.
        $this->as('ahmed')->postJson($this->api('offboardings/'.$resignation['id'].'/cancel'), ['comment' => 'Changed my mind.'])
            ->assertOk()->assertJsonPath('data.status', 'Cancelled');
    }

    public function test_approval_and_rejection(): void
    {
        $case = $this->start(self::SARAH, ['type' => 'Resignation', 'noticeMode' => 'Served']);
        $path = $this->api('offboardings/'.$case['id']);

        // The checklist waits for approval.
        $this->as('admin')->patchJson($path.'/tasks/'.$case['tasks'][0]['id'], ['status' => 'Done'])->assertStatus(422);

        $this->as('admin')->postJson($path.'/decision', ['decision' => 'reject'])->assertUnprocessable()->assertJsonValidationErrors('comment');
        $this->as('admin')->postJson($path.'/decision', ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('data.status', 'In Progress')->assertJsonPath('data.decidedByName', 'Mohammed Al Yahyaei');
        $this->as('admin')->postJson($path.'/decision', ['decision' => 'reject', 'comment' => 'Too late'])->assertUnprocessable();

        $other = $this->start(self::AHMED);
        $this->as('admin')->postJson($this->api('offboardings/'.$other['id'].'/decision'), ['decision' => 'reject', 'comment' => 'Kept on.'])
            ->assertOk()->assertJsonPath('data.status', 'Rejected');
    }

    public function test_it_cannot_complete_while_assets_are_out_or_the_checklist_is_open(): void
    {
        $case = $this->start();
        $path = $this->api('offboardings/'.$case['id']);

        $this->as('admin')->postJson($path.'/complete')->assertUnprocessable()->assertJsonValidationErrors('case');
        $this->as('admin')->postJson($path.'/decision', ['decision' => 'approve'])->assertOk();

        $refused = $this->as('admin')->postJson($path.'/complete')->assertUnprocessable()->json('errors.case');
        $this->assertCount(2, $refused);   // three assets out, twelve items open
        $this->assertStringContainsString('3 assigned assets', $refused[0]);

        $this->clearChecklist($case);
        $refused = $this->as('admin')->postJson($path.'/complete')->assertUnprocessable()->json('errors.case');
        $this->assertCount(1, $refused);   // only the assets now

        // Setting an item aside needs a reason.
        $this->as('admin')->patchJson($path.'/tasks/'.$case['tasks'][3]['id'], ['status' => 'Not Applicable'])
            ->assertUnprocessable()->assertJsonValidationErrors('notes');

        // Return two, write one off: the register is what clears.
        $assets = EmployeeAsset::where('employee_id', self::AHMED)->outstanding()->get();
        foreach ($assets as $i => $asset) {
            $this->as('admin')->patchJson($this->api('employees/'.self::AHMED.'/assets/'.$asset->id), $i < 2
                ? ['action' => 'return', 'returnDate' => '2026-10-09']
                : ['action' => 'dispose', 'disposalDate' => '2026-10-09'])->assertOk();
        }
        $this->as('admin')->getJson($path)->assertOk()->assertJsonPath('data.assetsOutstanding', 0)->assertJsonPath('data.blockers', []);
    }

    public function test_completion_makes_the_employee_inactive_and_revokes_access(): void
    {
        $case = $this->start();
        $path = $this->api('offboardings/'.$case['id']);
        $this->as('admin')->postJson($path.'/decision', ['decision' => 'approve'])->assertOk();
        $this->clearChecklist($case);
        EmployeeAsset::where('employee_id', self::AHMED)->outstanding()->update(['status' => 'Returned', 'return_date' => '2026-10-09']);

        $ahmed = User::where('email', 'ahmed@sadeed.om')->first();
        $ahmed->createToken('phone');
        PermissionDelegation::create(['employee_id' => self::AHMED, 'permissions' => ['cases.edit'], 'starts_on' => '2026-10-01', 'ends_on' => '2026-12-31', 'reason' => 'Cover']);

        $this->as('admin')->putJson($path.'/interview', ['date' => '2026-10-15', 'primaryReason' => 'Restructuring', 'satisfaction' => 4, 'wouldRecommend' => true, 'eligibleForRehire' => true])
            ->assertOk()->assertJsonPath('data.exitInterview.satisfaction', 4);

        // Nobody completes their own.
        $this->as('ahmed')->postJson($path.'/complete')->assertForbidden();

        $done = $this->as('admin')->postJson($path.'/complete')->assertOk()
            ->assertJsonPath('data.status', 'Completed')
            ->assertJsonPath('data.employee.status', 'Inactive')
            ->json('data');
        $this->assertNotNull($done['settlement']);
        $this->assertSame(0.0, (float) $done['settlement']['gratuity']);   // Omani: the fund pays

        $this->assertDatabaseHas('employees', ['id' => self::AHMED, 'status' => 'Inactive', 'last_working_date' => '2026-10-20', 'decision_maker' => 'Management Decision', 'reason_for_leaving' => 'Restructuring']);
        // The account is kept, but signed out everywhere and refused at sign-in.
        $this->assertDatabaseHas('users', ['email' => 'ahmed@sadeed.om']);
        $this->assertSame(0, $ahmed->tokens()->count());
        $this->assertNull(PermissionDelegation::where('employee_id', self::AHMED)->whereNull('revoked_at')->first());
        $this->assertSame([], EmployeePermission::where('employee_id', self::AHMED)->first()->grants);
        $this->postJson($this->api('auth/login'), ['email' => 'ahmed@sadeed.om', 'password' => 'password'])->assertUnprocessable();
        $this->assertDatabaseHas('permission_events', ['employee_id' => self::AHMED, 'action' => 'revoked']);

        // A closed case stays closed.
        $this->as('admin')->postJson($path.'/complete')->assertUnprocessable();
        $this->as('admin')->postJson($path.'/cancel', ['comment' => 'x'])->assertStatus(422);
        $this->assertSame(Offboarding::COMPLETED, Offboarding::find($case['id'])->status);
    }
}
