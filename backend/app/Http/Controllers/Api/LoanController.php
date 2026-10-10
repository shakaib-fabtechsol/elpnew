<?php

namespace App\Http\Controllers\Api;

use App\Enums\Decision;
use App\Enums\RequestStatus;
use App\Http\Requests\Employees\LoanRequest;
use App\Http\Requests\Workflow\DecisionRequest;
use App\Http\Resources\LoanResource;
use App\Models\Employee;
use App\Models\Loan;
use App\Services\Eligibility;
use App\Services\LoanSchedule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LoanController extends MoneyRequestController
{
    protected string $model = Loan::class;

    protected string $resource = LoanResource::class;

    protected string $form = LoanRequest::class;

    protected string $dateColumn = 'requested_on';

    /** Each loan on the list carries its schedule and balance, as a single one does. */
    protected function filter(Builder $query, Request $request): void
    {
        $query->with('payments');
    }

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        $firstDue = LoanSchedule::monthEnd($data['start_month']);
        if (! $firstDue) {
            throw ValidationException::withMessages(['startMonth' => 'Choose a valid month.']);
        }
        unset($data['start_month']);

        return [
            ...$data,
            'first_due' => $firstDue,
            'requested_on' => $existing?->requested_on?->format('Y-m-d') ?? now()->format('Y-m-d'),
            // Not a choice: what the employee already owes decides it.
            'kind' => $existing->kind ?? Eligibility::loanKind($employee),
            // Paid to the account on the employee's record.
            'bank_name' => $employee->bank_name,
            'account_number' => $employee->account_number,
        ];
    }

    protected function guard(array $data, Employee $employee, ?Model $existing): void
    {
        $open = Eligibility::openLoan($employee);
        if ($open && $open->id !== $existing?->id) {
            throw ValidationException::withMessages([
                'loanAmount' => 'A new loan cannot be requested while '.$open->request_no.' is still open.',
            ]);
        }

        if ($data['first_due'] < now()->endOfMonth()->format('Y-m-d')) {
            throw ValidationException::withMessages(['startMonth' => 'Deductions cannot start in a month that has passed.']);
        }

        $limit = Eligibility::loanLimit($employee);
        if ((float) $data['loan_amount'] > $limit) {
            throw ValidationException::withMessages([
                'loanAmount' => 'The most you can borrow is '.number_format($limit, 3).' OMR ('.Loan::LIMIT_MONTHS.' months of net salary less what is still owed).',
            ]);
        }
    }

    /** A partial approval may set a new installment as well as a new sum. */
    protected function beforeDecision(Model $record, DecisionRequest $request): void
    {
        if ($request->decision() === Decision::Partial && $request->validated('approvedMonthly')) {
            $record->approved_monthly = $request->validated('approvedMonthly');
        }
    }

    /** The money leaves on the payment date; the schedule runs from the first due date. */
    protected function paymentFields(Model $record, array $payment): array
    {
        return [...$payment, 'disbursement_date' => $payment['payment_date']];
    }

    protected function load(Model $record): Model
    {
        return parent::load($record)->load('payments');
    }

    /**
     * Records what was repaid against one installment (payroll or by hand),
     * or defers it.
     */
    public function recordInstallment(Request $request, int $id): LoanResource
    {
        Gate::authorize('pay');
        $loan = $this->find($request->user(), $id);

        if ($loan->status !== RequestStatus::Paid) {
            throw ValidationException::withMessages(['status' => 'Repayments are recorded only on a loan that has been paid out.']);
        }

        $dueDates = array_column($loan->load('payments')->scheduleRows(), 'due');
        $data = $request->validate([
            'dueDate' => ['required', 'date_format:Y-m-d', Rule::in($dueDates)],
            'amount' => ['required_unless:deferred,true', 'numeric', 'min:0'],
            'paidOn' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'deferred' => ['boolean'],
        ], ['dueDate.in' => 'That date is not one of this loan\'s installments.']);

        $loan->payments()->updateOrCreate(
            ['due_date' => $data['dueDate']],
            [
                'amount' => ($data['deferred'] ?? false) ? 0 : $data['amount'],
                'paid_on' => ($data['deferred'] ?? false) ? null : ($data['paidOn'] ?? now()->format('Y-m-d')),
                'deferred' => $data['deferred'] ?? false,
                'source' => 'manual',
            ],
        );

        $this->workflow->log($loan, ($data['deferred'] ?? false) ? 'Installment deferred' : 'Installment repaid', null, null, $request->user(), (float) ($data['amount'] ?? 0), null, $data['dueDate']);

        return new LoanResource($this->load($loan->refresh()));
    }
}
