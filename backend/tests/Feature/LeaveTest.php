<?php

namespace Tests\Feature;

class LeaveTest extends ApiTestCase
{
    public function test_two_stage_approval(): void
    {
        $id = $this->as('ahmed')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-11-01', 'to' => '2026-11-05', 'reason' => 'Family visit'])
            ->assertCreated()
            ->assertJsonPath('data.leaveNo', 'LEV-016')
            ->assertJsonPath('data.countedDays', 5)
            ->assertJsonPath('data.workflowLabel', 'Pending Department Approval')
            ->json('data.id');

        // Management cannot jump the department stage.
        $this->as('admin')->postJson($this->api("leaves/$id/decision"), ['decision' => 'approve'])->assertUnprocessable();

        $this->as('admin')->postJson($this->api("leaves/$id/department-decision"), ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('data.workflowLabel', 'Pending Management Approval')
            ->assertJsonPath('data.departmentBy', 'Mohammed Al Yahyaei');

        $this->as('admin')->postJson($this->api("leaves/$id/decision"), ['decision' => 'approve', 'comment' => 'Enjoy.'])
            ->assertOk()->assertJsonPath('data.status', 'Approved')
            ->assertJsonPath('data.decidedBy', 'Mohammed Al Yahyaei');
    }

    public function test_no_more_days_than_are_left(): void
    {
        // Aisha used all 30 days of 2026 annual leave (7 + 23).
        $this->as('aisha')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-11-01', 'to' => '2026-11-03', 'reason' => 'Rest'])
            ->assertUnprocessable()->assertJsonValidationErrors('to');
    }

    public function test_advance_leave_only_once_this_years_is_used(): void
    {
        $this->as('aisha')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-11-01', 'to' => '2026-11-03', 'year' => 2027, 'reason' => 'Rest'])
            ->assertCreated()->assertJsonPath('data.isAdvance', true)->assertJsonPath('data.typeLabel', 'Advance Annual Leave');

        $this->as('ahmed')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-11-01', 'to' => '2026-11-03', 'year' => 2027, 'reason' => 'Rest'])
            ->assertUnprocessable()->assertJsonValidationErrors('year');
    }

    public function test_dates_cannot_overlap_or_run_backwards(): void
    {
        // Ahmed is on sick leave from -3 to +4 days.
        $this->as('ahmed')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-10-10', 'to' => '2026-10-11', 'reason' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('from');

        $this->as('ahmed')->postJson($this->api('leaves'), ['type' => 'Annual Leave', 'from' => '2026-11-10', 'to' => '2026-11-01', 'reason' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('to');
    }

    public function test_rejection_needs_a_reason(): void
    {
        $id = $this->as('ahmed')->postJson($this->api('leaves'), ['type' => 'Marriage Leave', 'from' => '2026-12-01', 'to' => '2026-12-03', 'reason' => 'Wedding'])->json('data.id');

        $this->as('admin')->postJson($this->api("leaves/$id/department-decision"), ['decision' => 'reject'])
            ->assertUnprocessable()->assertJsonValidationErrors('comment');
    }

    public function test_balance_endpoint_lists_every_type(): void
    {
        $this->as('aisha')->getJson($this->api('employees/7/leave-balance'))
            ->assertOk()
            ->assertJsonPath('data.canTakeAdvance', true)
            ->assertJsonPath('data.types.0.type', 'Annual Leave')
            ->assertJsonPath('data.types.0.balance.remaining', 0)
            ->assertJsonPath('data.types.1.balance', null); // Sick leave: "Up to 182 Days"
    }
}
