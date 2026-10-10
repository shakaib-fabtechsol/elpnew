<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workflow\PaymentRequest;
use App\Http\Resources\SalaryPaymentResource;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\SalaryAdvance;
use App\Models\SalaryPayment;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Monthly salaries. A salary is prepared as a request (REQ-004) with what
 * comes off it worked out - the loan installment due that month and any
 * advance deducted from it - then transferred (SAL-007) or rejected.
 */
class SalaryPaymentController extends Controller
{
    public function __construct(private RequestWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = SalaryPayment::query()->visibleTo($request->user())->with('employee')
            ->when($request->integer('employeeId'), fn (Builder $q, $id) => $q->where('employee_id', $id))
            ->when($request->integer('year'), fn (Builder $q, $y) => $q->where('year', $y))
            ->when($request->integer('month'), fn (Builder $q, $m) => $q->where('month', $m))
            ->when($request->string('status')->toString(), fn (Builder $q, $s) => $q->whereIn('status', explode(',', $s)))
            // A salary still waiting sits above the paid ones.
            ->orderByRaw("case when status = 'Pending' then 0 else 1 end")
            ->orderByDesc('year')->orderByDesc('month');

        return SalaryPaymentResource::collection($query->paginate(min($request->integer('perPage', 12), 100)));
    }

    public function show(Request $request, int $id): SalaryPaymentResource
    {
        return new SalaryPaymentResource($this->find($request, $id)->load('employee'));
    }

    /** Prepares a month's salary from the employee's pay and what is due from it. */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('pay');
        $data = $request->validate([
            'employeeId' => ['required', 'integer', 'exists:employees,id'],
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2020,2100'],
            'administrative' => ['nullable', 'numeric', 'min:0'],
            'administrativeReason' => ['nullable', 'string', 'max:255', 'required_with:administrative'],
        ]);

        $employee = Employee::findOrFail($data['employeeId']);
        $already = SalaryPayment::where('employee_id', $employee->id)->where('year', $data['year'])->where('month', $data['month'])
            ->whereIn('status', [SalaryPayment::PENDING, SalaryPayment::TRANSFERRED])->first();
        if ($already) {
            throw ValidationException::withMessages(['month' => 'The salary for this month is already '.($already->status === SalaryPayment::PENDING ? 'waiting as '.$already->request_no : 'paid as '.$already->salary_no).'.']);
        }

        $payment = SalaryPayment::create([
            'employee_id' => $employee->id,
            'month' => $data['month'],
            'year' => $data['year'],
            'basic' => $employee->salary,
            'allowances' => $employee->totalAllowances(),
            'loan_deducted' => $this->loanDue($employee, $data['year'], $data['month']),
            'advance_deducted' => $this->advanceDue($employee, $data['year'], $data['month']),
            'administrative' => $data['administrative'] ?? $employee->administrative,
            'administrative_reason' => $data['administrativeReason'] ?? null,
            'status' => SalaryPayment::PENDING,
        ]);
        $this->workflow->log($payment, 'Salary prepared', null, SalaryPayment::PENDING, $request->user(), $payment->net());

        return (new SalaryPaymentResource($payment->load('employee')))->response()->setStatusCode(201);
    }

    /** Transfers the salary and records the loan installment it repaid. */
    public function transfer(PaymentRequest $request, int $id): SalaryPaymentResource
    {
        Gate::authorize('pay');
        $payment = $this->find($request, $id);
        if ($payment->status !== SalaryPayment::PENDING) {
            throw ValidationException::withMessages(['status' => 'This salary has already been '.strtolower($payment->status).'.']);
        }

        DB::transaction(function () use ($payment, $request) {
            $data = $request->columns();
            $payment->fill([
                'payment_method' => $data['payment_method'],
                'bank_account' => $data['bank_account'] ?? null,
                'payment_reference' => $data['payment_reference'] ?? null,
                'payment_date' => $data['payment_date'],
                'paid_by' => $request->user()->id,
            ]);
            $payment->transfer();
            $payment->save();

            $this->recordLoanRepayment($payment);
            $this->workflow->log($payment, 'Salary transferred', SalaryPayment::PENDING, SalaryPayment::TRANSFERRED, $request->user(), $payment->net(), null, $payment->payment_reference);
        });

        return new SalaryPaymentResource($payment->load('employee'));
    }

    public function reject(Request $request, int $id): SalaryPaymentResource
    {
        Gate::authorize('pay');
        $payment = $this->find($request, $id);
        $data = $request->validate(['reason' => ['required', 'string', 'max:300']]);
        if ($payment->status !== SalaryPayment::PENDING) {
            throw ValidationException::withMessages(['status' => 'Only a waiting salary can be rejected.']);
        }

        $payment->update(['status' => SalaryPayment::REJECTED, 'rejection_reason' => $data['reason']]);
        $this->workflow->log($payment, 'Salary rejected', SalaryPayment::PENDING, SalaryPayment::REJECTED, $request->user(), null, $data['reason']);

        return new SalaryPaymentResource($payment->load('employee'));
    }

    /* ------------------------------------------------------------ dues */

    /** Installments falling due in the month on loans paid out. */
    private function loanDue(Employee $employee, int $year, int $month): float
    {
        $prefix = sprintf('%04d-%02d', $year, $month);

        return round(Loan::with('payments')->where('employee_id', $employee->id)->where('status', RequestStatus::Paid)->get()
            ->sum(function (Loan $loan) use ($prefix) {
                $row = collect($loan->scheduleRows())->first(fn ($r) => str_starts_with($r['due'], $prefix));

                return $row && $row['status'] !== 'Paid' && $row['status'] !== 'Deferred' ? $row['installment'] - $row['paid'] : 0;
            }), 3);
    }

    /** Advances granted to come out of this month. */
    private function advanceDue(Employee $employee, int $year, int $month): float
    {
        return round(SalaryAdvance::where('employee_id', $employee->id)
            ->whereIn('status', [RequestStatus::Approved, RequestStatus::Paid])
            ->where('deduct_year', $year)
            ->where('deduct_month', SalaryAdvance::MONTHS[$month - 1])
            ->get()->sum(fn (SalaryAdvance $a) => $a->grantedAmount()), 3);
    }

    /** What came off the pay for a loan is recorded against the installment. */
    private function recordLoanRepayment(SalaryPayment $payment): void
    {
        $left = (float) $payment->loan_deducted;
        if ($left <= 0) {
            return;
        }

        $prefix = sprintf('%04d-%02d', $payment->year, $payment->month);
        $loans = Loan::with('payments')->where('employee_id', $payment->employee_id)->where('status', RequestStatus::Paid)->orderBy('first_due')->get();

        foreach ($loans as $loan) {
            $row = collect($loan->scheduleRows())->first(fn ($r) => str_starts_with($r['due'], $prefix));
            if (! $row || $left <= 0) {
                continue;
            }
            $amount = min($left, $row['installment'] - $row['paid']);
            if ($amount <= 0) {
                continue;
            }
            $loan->payments()->updateOrCreate(['due_date' => $row['due']], ['amount' => $row['paid'] + $amount, 'paid_on' => $payment->payment_date, 'deferred' => false, 'source' => 'payroll']);
            $left -= $amount;
        }
    }

    private function find(Request $request, int $id): SalaryPayment
    {
        return SalaryPayment::query()->visibleTo($request->user())->findOrFail($id);
    }
}
