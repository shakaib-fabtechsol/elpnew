<?php

namespace Tests\Feature;

use App\Models\SalaryAdvance;

/** The SADEED workflow end to end, on the salary advance. */
class SalaryAdvanceWorkflowTest extends ApiTestCase
{
    private function submit(array $overrides = [])
    {
        return $this->as('aisha')->postJson($this->api('salary-advances'), [
            'amount' => 300,
            'deductMonth' => 'December',
            'deductYear' => 2026,
            'purpose' => 'Medical Expenses',
            'reason' => 'Dental work.',
            ...$overrides,
        ]);
    }

    public function test_full_journey_submit_partial_approval_payment(): void
    {
        $id = $this->submit()
            ->assertCreated()
            ->assertJsonPath('data.requestNo', 'SA-2026-00016')
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.employee.name', 'Aisha Al Kindi')
            ->json('data.id');

        $this->as('admin')->postJson($this->api("salary-advances/$id/decision"), ['decision' => 'partial', 'approvedAmount' => 250, 'comment' => 'Within policy.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Approved')
            ->assertJsonPath('data.statusLabel', 'Partially Approved')
            ->assertJsonPath('data.grantedAmount', 250);

        $this->as('accounts')->postJson($this->api("salary-advances/$id/payment"), [
            'paymentMethod' => 'Bank Transfer',
            'paymentDate' => '2026-10-09',
            'bankAccount' => 'Bank Muscat — 6789',
            'paymentReference' => 'TRX-1',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Paid')
            ->assertJsonPath('data.subcategory', 'Salary Advance');

        $this->as('aisha')->getJson($this->api("salary-advances/$id/history"))
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.action', 'Amount disbursed')
            ->assertJsonPath('data.2.action', 'Request submitted');
    }

    public function test_cannot_ask_for_more_than_the_salary_leaves(): void
    {
        // Net 2034 less SA-13 (300, deducted in October - not yet reached? October is this month, so reached).
        $this->submit(['amount' => 5000])->assertUnprocessable()->assertJsonValidationErrors('amount');
    }

    public function test_cannot_deduct_from_a_month_gone_by(): void
    {
        $this->submit(['deductMonth' => 'January'])->assertUnprocessable()->assertJsonValidationErrors('deductMonth');
    }

    public function test_partial_must_be_less_than_requested_and_return_needs_a_comment(): void
    {
        $id = SalaryAdvance::where('request_no', 'SA-2026-00012')->value('id');

        $this->as('admin')->postJson($this->api("salary-advances/$id/decision"), ['decision' => 'partial', 'approvedAmount' => 400])
            ->assertUnprocessable()->assertJsonValidationErrors('approvedAmount');

        $this->as('admin')->postJson($this->api("salary-advances/$id/decision"), ['decision' => 'return'])
            ->assertUnprocessable()->assertJsonValidationErrors('comment');

        $this->as('admin')->postJson($this->api("salary-advances/$id/decision"), ['decision' => 'reject'])
            ->assertUnprocessable()->assertJsonValidationErrors('comment');
    }

    public function test_a_decided_request_cannot_be_decided_or_paid_twice(): void
    {
        $approved = SalaryAdvance::where('request_no', 'SA-2026-00015')->value('id'); // already paid

        $this->as('admin')->postJson($this->api("salary-advances/$approved/decision"), ['decision' => 'full'])
            ->assertUnprocessable()->assertJsonValidationErrors('decision');

        $this->as('accounts')->postJson($this->api("salary-advances/$approved/payment"), ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_a_pending_request_cannot_be_paid(): void
    {
        $pending = SalaryAdvance::where('request_no', 'SA-2026-00012')->value('id');

        $this->as('accounts')->postJson($this->api("salary-advances/$pending/payment"), ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_a_transfer_needs_a_reference_and_no_future_date(): void
    {
        $approved = SalaryAdvance::where('request_no', 'SA-2026-00013')->value('id');

        $this->as('accounts')->postJson($this->api("salary-advances/$approved/payment"), ['paymentMethod' => 'Bank Transfer', 'paymentDate' => '2026-12-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['paymentReference', 'paymentDate']);
    }

    public function test_returned_request_is_resubmitted_back_to_pending(): void
    {
        $returned = SalaryAdvance::where('request_no', 'SA-2026-00014')->value('id');

        $this->as('aisha')->putJson($this->api("salary-advances/$returned"), [
            'amount' => 500, 'deductMonth' => 'November', 'deductYear' => 2026, 'purpose' => 'Education Expenses', 'reason' => 'Adjusted.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.amount', 500)
            ->assertJsonPath('data.decision', null);
    }

    public function test_roles_are_enforced(): void
    {
        $pending = SalaryAdvance::where('request_no', 'SA-2026-00012')->value('id');
        $ahmeds = SalaryAdvance::where('request_no', 'SA-2026-00008')->value('id');

        // A lawyer cannot decide, accounting cannot decide, a lawyer cannot pay.
        $this->as('aisha')->postJson($this->api("salary-advances/$pending/decision"), ['decision' => 'full'])->assertForbidden();
        $this->as('accounts')->postJson($this->api("salary-advances/$pending/decision"), ['decision' => 'full'])->assertForbidden();
        $this->as('aisha')->postJson($this->api("salary-advances/$pending/payment"), ['paymentMethod' => 'Cash', 'paymentDate' => '2026-10-09'])->assertForbidden();

        // Nobody sees another employee's request unless they see everyone.
        $this->as('aisha')->getJson($this->api("salary-advances/$ahmeds"))->assertNotFound();
        $this->as('aisha')->getJson($this->api('salary-advances'))->assertOk()->assertJsonCount(4, 'data');
        $this->as('accounts')->getJson($this->api('salary-advances?perPage=50'))->assertOk()->assertJsonCount(15, 'data');
    }

    public function test_withdrawing_before_a_decision(): void
    {
        $pending = SalaryAdvance::where('request_no', 'SA-2026-00012')->value('id');
        $this->as('aisha')->deleteJson($this->api("salary-advances/$pending"))->assertOk()->assertJsonPath('data.status', 'Cancelled');
    }
}
