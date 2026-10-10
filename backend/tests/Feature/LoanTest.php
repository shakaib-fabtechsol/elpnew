<?php

namespace Tests\Feature;

use App\Models\Loan;
use App\Services\LoanSchedule;

class LoanTest extends ApiTestCase
{
    public function test_schedule_keeps_month_end_and_shortens_the_last_installment(): void
    {
        $rows = LoanSchedule::rows(1000, 300, '2026-09-30');

        $this->assertSame(['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31'], array_column($rows, 'due'));
        $this->assertSame([300.0, 300.0, 300.0, 100.0], array_column($rows, 'installment'));
        // A start on the 15th keeps the 15th; on the 31st it falls back in short months.
        $this->assertSame('2027-02-28', LoanSchedule::dueDate('2027-01-31', 1));
        $this->assertSame('2026-11-15', LoanSchedule::dueDate('2026-10-15', 1));
    }

    public function test_a_loan_cannot_be_requested_while_another_is_open(): void
    {
        // Aisha has LNR-006 pending.
        $this->as('aisha')->postJson($this->api('loans'), ['loanAmount' => 1000, 'monthly' => 100, 'startMonth' => 'December 2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('loanAmount');
    }

    public function test_full_journey_with_partial_terms_payment_and_repayment(): void
    {
        $id = $this->as('ahmed')->postJson($this->api('loans'), ['loanAmount' => 1200, 'monthly' => 200, 'startMonth' => 'November 2026', 'comment' => 'Car repair'])
            ->assertCreated()
            ->assertJsonPath('data.requestNo', 'LNR-007')
            ->assertJsonPath('data.kind', 'New Loan')
            ->assertJsonPath('data.firstDue', '2026-11-30')
            ->assertJsonPath('data.bankName', 'Bank Dhofar')
            ->json('data.id');

        $this->as('admin')->postJson($this->api("loans/$id/decision"), ['decision' => 'partial', 'approvedAmount' => 900, 'approvedMonthly' => 150, 'comment' => 'Reduced.'])
            ->assertOk()
            ->assertJsonPath('data.statusLabel', 'Partial Approval')
            ->assertJsonPath('data.total', 900)
            ->assertJsonPath('data.installment', 150)
            ->assertJsonCount(6, 'data.schedule');

        $this->as('accounts')->postJson($this->api("loans/$id/payment"), ['paymentMethod' => 'Bank Transfer', 'paymentDate' => '2026-10-09', 'bankAccount' => 'Bank Muscat', 'paymentReference' => 'TRX-L'])
            ->assertOk()
            ->assertJsonPath('data.statusLabel', 'Active')
            ->assertJsonPath('data.disbursementDate', '2026-10-09');

        // A repayment against a date that is not on the schedule is refused.
        $this->as('accounts')->postJson($this->api("loans/$id/installments"), ['dueDate' => '2026-11-15', 'amount' => 150])
            ->assertUnprocessable()->assertJsonValidationErrors('dueDate');

        $this->as('accounts')->postJson($this->api("loans/$id/installments"), ['dueDate' => '2026-11-30', 'amount' => 150, 'paidOn' => '2026-10-09'])
            ->assertOk()
            ->assertJsonPath('data.paid', 150)
            ->assertJsonPath('data.remaining', 750)
            ->assertJsonPath('data.schedule.0.status', 'Paid');
    }

    public function test_cannot_borrow_beyond_the_limit(): void
    {
        // Ahmed: net 800+96+40+24-56 = 904; 10 months = 9040.
        $this->as('ahmed')->postJson($this->api('loans'), ['loanAmount' => 10000, 'monthly' => 500, 'startMonth' => 'November 2026'])
            ->assertUnprocessable()->assertJsonValidationErrors('loanAmount');
    }

    public function test_seeded_running_loan_reads_its_balance(): void
    {
        $id = Loan::where('request_no', 'LNR-005')->value('id');

        $this->as('aisha')->getJson($this->api("loans/$id"))
            ->assertOk()
            ->assertJsonPath('data.total', 3000)
            ->assertJsonPath('data.paid', 900)
            ->assertJsonPath('data.remaining', 2100)
            ->assertJsonPath('data.nextInstallment.due', '2026-10-31');
    }

    public function test_the_list_carries_each_loans_schedule_and_balance(): void
    {
        $rows = collect($this->as('admin')->getJson($this->api('loans?perPage=100'))->assertOk()->json('data'));
        $loan = $rows->firstWhere('requestNo', 'LNR-005');

        $this->assertSame(2100, $loan['remaining']);
        $this->assertSame('Active', $loan['statusLabel']);
        $this->assertCount(10, $loan['schedule']);
    }
}
