<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Permissions\PermissionCatalog;
use Illuminate\Support\Facades\Http;

/** System Permissions: what an employee may see and do, and that it is enforced. */
class PermissionTest extends ApiTestCase
{
    private const AHMED = 3;   // lawyer, Legal Services

    private const AISHA = 7;   // lawyer, Legal Services

    private const SARAH = 4;   // Administration

    private function state(array $over = []): array
    {
        return [...['template' => 'lawyer', 'grants' => PermissionCatalog::template('lawyer')['grants'], 'scope' => 'own', 'departments' => [], 'approvalLimit' => null, 'paymentLimit' => null], ...$over];
    }

    private function grant(int $employee, array $over): void
    {
        $this->as('admin')->putJson($this->api("employees/$employee/permissions"), $this->state($over))->assertOk();
    }

    private function advance(string $who, float $amount): int
    {
        return $this->as($who)->postJson($this->api('salary-advances'), [
            'amount' => $amount, 'deductMonth' => 'December', 'deductYear' => '2026', 'purpose' => 'Emergency Case',
        ])->assertCreated()->json('data.id');
    }

    public function test_an_employee_starts_from_the_template_of_their_job(): void
    {
        $page = $this->as('admin')->getJson($this->api('employees/'.self::AHMED.'/permissions'))
            ->assertOk()
            ->assertJsonPath('data.settings.template', 'lawyer')
            ->assertJsonPath('data.settings.custom', false)
            ->assertJsonPath('data.settings.scope', 'own')
            ->assertJsonPath('data.fullAccess', false)
            ->assertJsonCount(7, 'data.catalog')
            ->json('data');

        $this->assertContains('cases.edit', $page['effective']);
        $this->assertNotContains('financingRequests.approve', $page['effective']);
        $this->assertSame(['own', 'department', 'all'], array_column($page['scopes'], 'value'));

        // A management account holds everything, whatever is ticked.
        $this->as('admin')->getJson($this->api('employees/1/permissions'))->assertJsonPath('data.fullAccess', true);
    }

    public function test_only_those_allowed_may_open_or_change_the_page_and_never_their_own(): void
    {
        $this->as('ahmed')->getJson($this->api('employees/'.self::AISHA.'/permissions'))->assertForbidden();
        $this->as('ahmed')->putJson($this->api('employees/'.self::AISHA.'/permissions'), $this->state())->assertForbidden();
        $this->as('admin')->putJson($this->api('employees/1/permissions'), $this->state(['template' => 'admin']))
            ->assertForbidden()->assertJsonPath('message', 'Nobody sets their own permissions. Ask another administrator.');
    }

    public function test_a_change_is_saved_and_written_to_the_history(): void
    {
        $grants = [...PermissionCatalog::template('lawyer')['grants'], 'leaveRequests.approve', 'not.a.permission'];

        $page = $this->as('admin')->putJson($this->api('employees/'.self::AISHA.'/permissions'), $this->state([
            'grants' => $grants, 'scope' => 'department', 'departments' => ['Legal Services'], 'approvalLimit' => 250,
        ]))->assertOk()
            ->assertJsonPath('data.settings.custom', true)
            ->assertJsonPath('data.settings.scope', 'department')
            ->assertJsonPath('data.settings.approvalLimit', 250)
            ->assertJsonPath('data.history.0.action', 'updated')
            ->assertJsonPath('data.history.0.granted', ['Leave Requests: Approve'])
            ->json('data');

        $this->assertNotContains('not.a.permission', $page['settings']['grants']);
        $this->assertStringContainsString('approval limit no limit → 250.000 OMR', $page['history'][0]['summary']);

        // Saving the same again writes nothing new.
        $this->as('admin')->putJson($this->api('employees/'.self::AISHA.'/permissions'), $this->state([
            'grants' => $grants, 'scope' => 'department', 'departments' => ['Legal Services'], 'approvalLimit' => 250,
        ]))->assertJsonCount(1, 'data.history');

        $this->as('admin')->putJson($this->api('employees/'.self::AISHA.'/permissions'), $this->state(['scope' => 'department']))
            ->assertUnprocessable()->assertJsonValidationErrors('departments');
    }

    public function test_record_access_reaches_as_far_as_it_is_set(): void
    {
        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED))->assertForbidden();

        $this->grant(self::AISHA, ['scope' => 'department', 'departments' => ['Legal Services']]);

        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED))->assertOk();
        $this->as('aisha')->getJson($this->api('employees/'.self::SARAH))->assertForbidden();

        $ids = array_column($this->as('aisha')->getJson($this->api('employees').'?perPage=100')->json('data'), 'department');
        $this->assertSame(['Legal Services'], array_values(array_unique($ids)));
    }

    public function test_approving_follows_the_permission_and_the_approval_limit(): void
    {
        $id = $this->advance('ahmed', 300);
        $approve = ['decision' => 'full'];

        // A lawyer does not decide requests.
        $this->as('aisha')->postJson($this->api("salary-advances/$id/decision"), $approve)->assertForbidden();

        // Given approval over her department, up to 100 OMR: this one is above it.
        $over = ['grants' => [...PermissionCatalog::template('lawyer')['grants'], 'financingRequests.approve', 'financingRequests.reject'], 'scope' => 'department', 'departments' => ['Legal Services']];
        $this->grant(self::AISHA, [...$over, 'approvalLimit' => 100]);
        $this->as('aisha')->postJson($this->api("salary-advances/$id/decision"), $approve)
            ->assertForbidden()->assertJsonPath('message', 'This is above your approval limit of 100.000 OMR. It needs somebody with higher authority.');

        // Within her limit she approves it.
        $this->grant(self::AISHA, [...$over, 'approvalLimit' => 500]);
        $this->as('aisha')->postJson($this->api("salary-advances/$id/decision"), $approve)->assertOk()->assertJsonPath('data.status', 'Approved');

        // Approving is not paying.
        $this->as('aisha')->postJson($this->api("salary-advances/$id/payment"), [])->assertForbidden();
    }

    public function test_temporary_access_works_while_it_lasts_and_is_gone_when_revoked(): void
    {
        $accountant = User::where('email', 'accounts@sadeed.om')->value('employee_id');
        $delegation = ['permissions' => ['financingRequests.pay'], 'fromEmployeeId' => $accountant, 'startsOn' => '2026-10-09', 'endsOn' => '2026-10-20', 'reason' => 'Covering while the accountant is on leave.'];

        // Nobody lends what they do not hold.
        $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/delegations'), [...$delegation, 'fromEmployeeId' => self::AHMED])
            ->assertUnprocessable()->assertJsonValidationErrors('permissions');

        $page = $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/delegations'), $delegation)
            ->assertCreated()
            ->assertJsonPath('data.delegations.0.state', 'Active')
            ->assertJsonPath('data.delegated', ['financingRequests.pay'])
            ->assertJsonPath('data.history.0.action', 'delegated')
            ->json('data');
        $this->assertContains('financingRequests.pay', $page['effective']);
        $this->as('aisha')->getJson($this->api('auth/me'))->assertJsonPath('data.permissions.pay', true);

        // It ends on its date without anybody doing anything.
        $this->travelTo('2026-10-21 09:00:00');
        $this->as('aisha')->getJson($this->api('auth/me'))->assertJsonPath('data.permissions.pay', false);
        $this->as('admin')->getJson($this->api('employees/'.self::AISHA.'/permissions'))->assertJsonPath('data.delegations.0.state', 'Expired');
        $this->travelTo('2026-10-09 10:00:00');

        // Or sooner, when it is revoked.
        $this->as('admin')->deleteJson($this->api('employees/'.self::AISHA.'/permissions/delegations/'.$page['delegations'][0]['id']))
            ->assertOk()->assertJsonPath('data.delegations.0.state', 'Revoked')->assertJsonPath('data.delegated', []);
        $this->as('aisha')->getJson($this->api('auth/me'))->assertJsonPath('data.permissions.pay', false);
    }

    public function test_confidential_parts_of_a_record_need_their_own_permission(): void
    {
        // Reaching the record is not seeing its salary, bank details or papers.
        $this->grant(self::AISHA, ['grants' => [...PermissionCatalog::template('lawyer')['grants'], 'employees.view'], 'scope' => 'department', 'departments' => ['Legal Services']]);
        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED))->assertOk()
            ->assertJsonPath('data.salary', null)->assertJsonPath('data.netSalary', null)
            ->assertJsonPath('data.iban', null)->assertJsonPath('data.civilId', null)
            ->assertJsonPath('data.restricted', ['payroll', 'bankDetails', 'identity'])
            ->assertJsonPath('data.name', 'Ahmed Al Balushi');

        $this->grant(self::AISHA, ['grants' => [...PermissionCatalog::template('lawyer')['grants'], 'payroll.view'], 'scope' => 'department', 'departments' => ['Legal Services']]);
        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED))
            ->assertJsonPath('data.salary', 800)->assertJsonPath('data.restricted', ['bankDetails', 'identity']);

        // Somebody who pays requests sees the bank details the payment goes to, whatever else is held back.
        $this->grant(self::AISHA, ['grants' => [...PermissionCatalog::template('lawyer')['grants'], 'financingRequests.pay'], 'scope' => 'department', 'departments' => ['Legal Services']]);
        $this->as('aisha')->getJson($this->api('employees/'.self::AHMED))
            ->assertJsonPath('data.restricted', ['payroll', 'identity'])
            ->assertJsonPath('data.bankName', fn ($bank) => filled($bank))
            ->assertJsonPath('data.accountNumber', fn ($account) => filled($account));

        // Her own record is always whole; management sees everything.
        $this->as('aisha')->getJson($this->api('employees/'.self::AISHA))->assertJsonPath('data.restricted', []);
        $this->as('admin')->getJson($this->api('employees/'.self::AHMED))->assertJsonPath('data.restricted', [])->assertJsonPath('data.salary', 800);
    }

    public function test_changing_records_and_issuing_circulars_follow_their_permissions(): void
    {
        $circular = ['date' => '2026-10-01', 'targetGroup' => 'All Employees', 'content' => 'Office closed on 18 November.'];
        $this->as('aisha')->patchJson($this->api('employees/'.self::AHMED), ['position' => 'Senior Associate'])->assertForbidden();
        $this->as('aisha')->postJson($this->api('circulars'), $circular)->assertForbidden();

        $this->grant(self::AISHA, ['grants' => [...PermissionCatalog::template('lawyer')['grants'], 'employees.edit', 'circulars.create'], 'scope' => 'department', 'departments' => ['Legal Services']]);

        $this->as('aisha')->patchJson($this->api('employees/'.self::AHMED), ['position' => 'Senior Associate'])->assertOk()->assertJsonPath('data.position', 'Senior Associate');
        // Editing reaches only as far as her record access does.
        $this->as('aisha')->patchJson($this->api('employees/'.self::SARAH), ['position' => 'x'])->assertForbidden();
        // Editing is not adding.
        $this->as('aisha')->postJson($this->api('employees'), ['employeeName' => 'New Person', 'salary' => 500, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer'])->assertForbidden();
        $this->as('aisha')->postJson($this->api('circulars'), $circular)->assertCreated();
    }

    public function test_a_login_account_is_created_with_a_password_shown_once(): void
    {
        $page = $this->as('admin')->getJson($this->api('employees/'.self::SARAH.'/permissions'))->assertJsonPath('data.hasAccount', false)->json('data');
        $this->assertCount(4, $page['roles']);

        $made = $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/permissions/account'), ['email' => 'sarah@sadeed.om', 'role' => 'accounting'])
            ->assertCreated()
            ->assertJsonPath('data.hasAccount', true)
            ->assertJsonPath('data.account.email', 'sarah@sadeed.om')
            ->assertJsonPath('data.settings.template', 'accounting')
            ->assertJsonPath('data.history.0.action', 'account')
            ->json('data');
        $this->assertSame(14, strlen($made['temporaryPassword']));

        // She signs in with it, and it is not handed out again.
        $this->postJson($this->api('auth/login'), ['email' => 'sarah@sadeed.om', 'password' => $made['temporaryPassword']])->assertOk()->assertJsonPath('data.user.role', 'accounting');
        $this->as('admin')->getJson($this->api('employees/'.self::SARAH.'/permissions'))->assertJsonMissingPath('data.temporaryPassword');

        // One account each; one email each; never one's own.
        $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/permissions/account'), ['email' => 'other@sadeed.om', 'role' => 'lawyer'])->assertUnprocessable();
        $this->as('admin')->postJson($this->api('employees/5/permissions/account'), ['email' => 'sarah@sadeed.om', 'role' => 'lawyer'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->as('ahmed')->postJson($this->api('employees/5/permissions/account'), ['email' => 'x@sadeed.om', 'role' => 'admin'])->assertForbidden();

        // A reset gives a new password and the old one stops working.
        $reset = $this->as('admin')->postJson($this->api('employees/'.self::SARAH.'/permissions/account/reset'))->assertOk()->json('data.temporaryPassword');
        $this->assertNotSame($made['temporaryPassword'], $reset);
        $this->postJson($this->api('auth/login'), ['email' => 'sarah@sadeed.om', 'password' => $made['temporaryPassword']])->assertStatus(422);
        $this->postJson($this->api('auth/login'), ['email' => 'sarah@sadeed.om', 'password' => $reset])->assertOk();

        $this->as('admin')->patchJson($this->api('employees/'.self::SARAH.'/permissions/account'), ['role' => 'lawyer'])
            ->assertOk()->assertJsonPath('data.account.role', 'lawyer')->assertJsonPath('data.history.0.summary', 'Account role changed from Accounting to Lawyer.');
    }

    public function test_the_access_review_names_what_deserves_a_second_look(): void
    {
        $risks = $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/review'), $this->state([
            'grants' => ['expenses.approve', 'expenses.pay', 'leaveRequests.create', 'leaveRequests.approve', 'permissions.edit', 'payroll.view'], 'scope' => 'all',
        ]))->assertOk()->json('data.risks');

        $titles = array_column($risks, 'title');
        $this->assertContains('Approves and pays Expenses', $titles);
        $this->assertContains('Files and approves Leave Requests', $titles);
        $this->assertContains('Can change system permissions', $titles);
        $this->assertContains('Confidential information for all employees', $titles);
        $this->assertContains('No approval limit', $titles);
        $this->assertSame('high', $risks[0]['level']);

        // The lawyer starting point as it stands raises nothing.
        $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/review'), $this->state())->assertJsonPath('data.risks', []);
    }

    public function test_an_instruction_in_words_becomes_a_proposal_and_nothing_is_saved(): void
    {
        Http::fake();

        $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/assist'), [...$this->state(), 'instruction' => 'Give her read-only access to payroll for 2 weeks'])
            ->assertOk()
            ->assertJsonPath('data.engine', 'rules')
            ->assertJsonPath('data.grant', ['payroll.view', 'salaries.view'])
            ->assertJsonPath('data.temporaryDays', 14)
            ->assertJsonPath('data.grantLabels.0', 'Salary & Payroll Details: View');

        $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/assist'), [...$this->state(), 'instruction' => 'remove create and edit on clients'])
            ->assertJsonPath('data.grant', [])->assertJsonPath('data.revoke', ['clients.create', 'clients.edit']);

        $this->as('admin')->getJson($this->api('employees/'.self::AISHA.'/permissions'))->assertJsonPath('data.settings.custom', false);
        Http::assertNothingSent();
    }

    public function test_what_the_ai_proposes_is_held_to_the_catalogue(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode([
            'explanation' => 'Adds approval of leave for her department.',
            'grant' => ['leaveRequests.approve', 'made.up', 'cases.view'], // one invented, one she already holds
            'revoke' => ['clients.delete'],                                   // not held: nothing to remove
            'scope' => 'department', 'departments' => ['Legal Services', 'Nowhere'],
            'approvalLimit' => 400, 'paymentLimit' => 999, 'setLimits' => ['approvalLimit'],
        ])]]]]]])]);

        $this->as('admin')->postJson($this->api('employees/'.self::AISHA.'/permissions/assist'), [...$this->state(), 'instruction' => 'let her approve leave for her department up to 400'])
            ->assertOk()
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.grant', ['leaveRequests.approve'])
            ->assertJsonPath('data.revoke', [])
            ->assertJsonPath('data.scope', 'department')
            ->assertJsonPath('data.departments', ['Legal Services'])
            ->assertJsonPath('data.approvalLimit', 400)
            ->assertJsonPath('data.paymentLimit', null);
    }
}
