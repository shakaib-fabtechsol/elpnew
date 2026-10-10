<?php

namespace Tests\Feature;

use App\Models\AssistanceRequest;
use App\Models\Circular;
use App\Models\Violation;

/** Violations, circulars, general requests, assistance and salaries. */
class HrModulesTest extends ApiTestCase
{
    public function test_violation_runs_through_all_five_stages(): void
    {
        $id = $this->as('admin')->postJson($this->api('violations'), ['employeeId' => 7, 'type' => 'Attendance', 'date' => '2026-10-05', 'description' => 'Late three days.'])
            ->assertCreated()->assertJsonPath('data.violationNo', null)->assertJsonPath('data.nextStage', 'response')->json('data.id');

        $this->as('aisha')->postJson($this->api("violations/$id/acknowledge"))->assertOk();
        $this->as('aisha')->postJson($this->api("violations/$id/response"), ['response' => 'Traffic on the Muscat expressway.'])->assertOk();

        // Not guilty cannot carry a penalty.
        $this->as('admin')->postJson($this->api("violations/$id/decision"), ['investigationResult' => 'Not Guilty', 'penaltyType' => 'Written Warning', 'decisionReasons' => 'x', 'penaltyDate' => '2026-10-09'])
            ->assertUnprocessable();

        $this->as('admin')->postJson($this->api("violations/$id/decision"), ['investigationResult' => 'Guilty', 'penaltyType' => 'Financial Deduction', 'deductionAmount' => 20, 'decisionReasons' => 'Repeated.', 'penaltyDate' => '2026-10-09'])
            ->assertOk()->assertJsonPath('data.violationNo', 'VIO-003')->assertJsonPath('data.status', 'Penalty Issued');

        $this->as('aisha')->postJson($this->api("violations/$id/appeal"), ['appealGrounds' => 'First time.'])->assertOk()->assertJsonPath('data.status', 'Under Appeal');

        $this->as('admin')->postJson($this->api("violations/$id/outcome"), ['appealOutcome' => 'Partially Accept Appeal and Modify Penalty', 'outcomeReasons' => 'First offence.'])
            ->assertUnprocessable()->assertJsonValidationErrors('modifiedPenaltyType');

        $this->as('admin')->postJson($this->api("violations/$id/outcome"), ['appealOutcome' => 'Partially Accept Appeal and Modify Penalty', 'outcomeReasons' => 'First offence.', 'modifiedPenaltyType' => 'Written Warning'])
            ->assertOk()->assertJsonPath('data.status', 'Closed');
    }

    public function test_only_the_employee_answers_their_violation(): void
    {
        $id = Violation::where('employee_id', 1)->value('id');
        $this->as('aisha')->postJson($this->api("violations/$id/response"), ['response' => 'x'])->assertNotFound();
    }

    public function test_circular_acknowledged_once_and_revision_keeps_the_original(): void
    {
        $active = Circular::where('circular_no', 'CIR-2026-004')->value('id');

        // Aisha is a lawyer in Muscat: the all-staff circular and the lawyers' one wait on her.
        $pending = $this->as('aisha')->getJson($this->api('circulars?pending=1'))->assertOk()->json('data.*.circularNo');
        $this->assertEqualsCanonicalizing(['CIR-2026-002', 'CIR-2026-004'], $pending);
        $this->as('aisha')->postJson($this->api("circulars/$active/acknowledge"))->assertOk()->assertJsonPath('data.acknowledgedByMe', true);
        $this->as('aisha')->postJson($this->api("circulars/$active/acknowledge"))->assertOk();
        $this->assertSame(2, Circular::find($active)->acknowledgements()->count());

        $new = $this->as('admin')->postJson($this->api("circulars/$active/revise"), ['date' => '2026-10-09', 'targetGroup' => 'All Employees', 'content' => 'Hours change.'])
            ->assertCreated()->assertJsonPath('data.supersedes', $active)->json('data.id');

        $this->assertSame('Completed', Circular::find($active)->status);
        $this->assertSame(2, Circular::find($active)->acknowledgements()->count());
        $this->assertContains($new, $this->as('aisha')->getJson($this->api('circulars?pending=1'))->json('data.*.id'));
    }

    public function test_general_request_needs_a_reason_to_reject(): void
    {
        $id = $this->as('aisha')->postJson($this->api('general-requests'), ['kind' => 'grievance', 'requestType' => 'Pay & Benefits', 'comment' => 'Missing allowance.'])
            ->assertCreated()->assertJsonPath('data.requestNo', 'GRV-2026-004')->json('data.id');

        $this->as('admin')->postJson($this->api("general-requests/$id/decision"), ['decision' => 'Rejected'])->assertUnprocessable()->assertJsonValidationErrors('remarks');
        $this->as('admin')->postJson($this->api("general-requests/$id/decision"), ['decision' => 'Approved'])->assertOk()->assertJsonPath('data.status', 'Approved');
    }

    public function test_assistance_one_at_a_time_and_within_the_yearly_limit(): void
    {
        // Aisha has ASR-007 pending.
        $this->as('aisha')->postJson($this->api('assistance-requests'), ['assistanceType' => 'Medical Assistance', 'amount' => 100, 'notes' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('amount');

        // Ahmed: 2 x net 904 = 1808 for the year.
        $this->as('ahmed')->postJson($this->api('assistance-requests'), ['assistanceType' => 'Medical Assistance', 'amount' => 2000, 'notes' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('amount');

        $this->as('ahmed')->postJson($this->api('assistance-requests'), ['assistanceType' => 'Medical Assistance', 'beneficiary' => 'Father', 'amount' => 500, 'notes' => 'Surgery'])
            ->assertCreated()->assertJsonPath('data.requestNo', 'ASR-009');
    }

    public function test_assistance_return_and_resubmit(): void
    {
        $id = AssistanceRequest::where('request_no', 'ASR-007')->value('id');
        $this->as('admin')->postJson($this->api("assistance-requests/$id/decision"), ['decision' => 'return', 'comment' => 'Attach the hospital estimate.'])
            ->assertOk()->assertJsonPath('data.status', 'Returned');

        $this->as('aisha')->putJson($this->api("assistance-requests/$id"), ['assistanceType' => 'Medical Assistance', 'beneficiary' => 'Father', 'amount' => 450, 'notes' => 'Estimate attached.'])
            ->assertOk()->assertJsonPath('data.status', 'Pending');
    }

    public function test_salary_prepared_with_dues_and_transferred(): void
    {
        // Aisha: LNR-005 installment due 31 Oct; SA-13 (300) deducted from October.
        $id = $this->as('accounts')->postJson($this->api('salaries'), ['employeeId' => 7, 'month' => 10, 'year' => 2026])
            ->assertCreated()
            ->assertJsonPath('data.referenceNo', 'REQ-007')
            ->assertJsonPath('data.loanDeducted', 300)
            ->assertJsonPath('data.advanceDeducted', 300)
            ->json('data.id');

        $this->as('accounts')->postJson($this->api('salaries'), ['employeeId' => 7, 'month' => 10, 'year' => 2026])->assertUnprocessable();

        $this->as('accounts')->postJson($this->api("salaries/$id/transfer"), ['paymentMethod' => 'Bank Transfer', 'paymentDate' => '2026-10-09', 'bankAccount' => 'Bank Muscat', 'paymentReference' => 'TRX-S'])
            ->assertOk()->assertJsonPath('data.salaryNo', 'SAL-007')->assertJsonPath('data.status', 'Transferred');

        // The installment the salary paid is now on the loan.
        $this->as('aisha')->getJson($this->api('loans?status=Paid'))->assertJsonPath('data.0.paid', 1200);
    }

    public function test_management_is_asked_only_for_circulars_issued_to_it(): void
    {
        // The admin is a partner: the all-staff circular, not the lawyers' or administration's.
        $this->assertSame(['CIR-2026-004'], $this->as('admin')->getJson($this->api('circulars?pending=1'))->assertOk()->json('data.*.circularNo'));
        $this->as('admin')->getJson($this->api('circulars'))->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('data.0.issuedBy', 'Mohammed Al Yahyaei');
    }

    public function test_circular_audit_names_the_circular(): void
    {
        $this->as('admin')->postJson($this->api('circulars'), ['date' => '2026-10-09', 'targetGroup' => 'Lawyers', 'content' => 'New filing rules.'])->assertCreated();
        $this->as('admin')->getJson($this->api('circulars-audit'))->assertOk()
            ->assertJsonPath('data.0.action', 'Issued')
            ->assertJsonPath('data.0.circularNo', 'CIR-2026-005')
            ->assertJsonPath('data.0.by', 'Mohammed Al Yahyaei');
    }

    public function test_deciders_are_named_on_violations_and_general_requests(): void
    {
        $id = $this->as('admin')->postJson($this->api('violations'), ['employeeId' => 7, 'type' => 'Attendance', 'date' => '2026-10-05', 'description' => 'Late.'])->json('data.id');
        $this->as('aisha')->postJson($this->api("violations/$id/response"), ['response' => 'Traffic.'])->assertOk();
        $this->as('admin')->postJson($this->api("violations/$id/decision"), ['investigationResult' => 'Guilty', 'penaltyType' => 'Written Warning', 'decisionReasons' => 'Late again.', 'penaltyDate' => '2026-10-09'])
            ->assertOk()->assertJsonPath('data.approvedBy', 'Mohammed Al Yahyaei');
        $this->assertNotNull($this->as('aisha')->getJson($this->api("violations/$id"))->json('data.approvedAt'));

        $this->as('admin')->getJson($this->api('general-requests?kind=general&status=Approved'))->assertOk()->assertJsonPath('data.0.reviewedBy', 'Mohammed Al Yahyaei');
    }

    public function test_lookups_serve_every_list(): void

    {
        $this->as('aisha')->getJson($this->api('lookups'))
            ->assertOk()
            ->assertJsonPath('data.salaryAdvance.purposes.0', 'Emergency Case')
            ->assertJsonPath('data.leave.categories.0.types.0.name', 'Annual Leave')
            ->assertJsonPath('data.entitlements.kinds.2.kind', 'medical');
    }
}
