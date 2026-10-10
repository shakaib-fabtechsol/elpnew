<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\AssistanceRequest;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\SalaryAdvance;
use Carbon\CarbonImmutable;

/**
 * How much an employee may still ask for - the same figures the AI Overview
 * panels show, worked out here so the screen and the rule that refuses a
 * request can never disagree.
 */
final class Eligibility
{
    /* ---------------------------------------------------- salary advance */

    /** Granted advances whose deduction month has not come yet: still owed. */
    public static function outstandingAdvances(Employee $employee, ?CarbonImmutable $today = null): float
    {
        $today ??= CarbonImmutable::today();
        $reached = (int) $today->format('Y') * 12 + (int) $today->format('n') - 1;

        return round(SalaryAdvance::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', [RequestStatus::Approved, RequestStatus::Paid])
            ->get()
            ->filter(fn (SalaryAdvance $a) => $a->deductionIndex() > $reached)
            ->sum(fn (SalaryAdvance $a) => $a->grantedAmount()), 3);
    }

    /** An advance comes out of one month's pay, so it cannot exceed what that pay leaves. */
    public static function advanceLimit(Employee $employee): float
    {
        return max(0.0, round($employee->netSalary() - self::outstandingAdvances($employee), 3));
    }

    public static function advanceSummary(Employee $employee): array
    {
        $outstanding = self::outstandingAdvances($employee);
        $waiting = SalaryAdvance::where('employee_id', $employee->id)->where('status', RequestStatus::Pending)->sum('amount');

        return [
            'netSalary' => $employee->netSalary(),
            'outstandingBalance' => $outstanding,
            'limit' => self::advanceLimit($employee),
            'waiting' => round((float) $waiting, 3),
            'eligible' => self::advanceLimit($employee) > 0,
        ];
    }

    /* -------------------------------------------------------------- loans */

    /** What is still owed on every loan paid out. */
    public static function outstandingLoans(Employee $employee): float
    {
        return round(Loan::with('payments')
            ->where('employee_id', $employee->id)
            ->where('status', RequestStatus::Paid)
            ->get()
            ->sum(fn (Loan $loan) => $loan->remaining()), 3);
    }

    public static function loanLimit(Employee $employee): float
    {
        return max(0.0, round($employee->netSalary() * Loan::LIMIT_MONTHS - self::outstandingLoans($employee), 3));
    }

    /** The request still waiting on a decision or on the employee, if any. */
    public static function openLoan(Employee $employee): ?Loan
    {
        return Loan::where('employee_id', $employee->id)
            ->whereIn('status', [RequestStatus::Pending, RequestStatus::Returned, RequestStatus::Approved])
            ->first();
    }

    /** Nothing owed is a new loan; anything still owed makes it an increase. */
    public static function loanKind(Employee $employee): string
    {
        return self::outstandingLoans($employee) > 0 ? Loan::INCREASE : Loan::NEW_LOAN;
    }

    public static function loanSummary(Employee $employee): array
    {
        $open = self::openLoan($employee);

        return [
            'netSalary' => $employee->netSalary(),
            'outstanding' => self::outstandingLoans($employee),
            'limit' => self::loanLimit($employee),
            'limitMonths' => Loan::LIMIT_MONTHS,
            'kind' => self::loanKind($employee),
            'openRequest' => $open?->request_no,
            'canRequest' => $open === null && self::loanLimit($employee) > 0,
        ];
    }

    /* --------------------------------------------------------- assistance */

    public static function assistanceSummary(Employee $employee, ?int $year = null): array
    {
        $year ??= (int) now()->format('Y');
        $limit = round($employee->netSalary() * AssistanceRequest::LIMIT_MONTHS, 3);

        $rows = AssistanceRequest::where('employee_id', $employee->id)->whereYear('request_date', $year)->get();
        $given = $rows->filter(fn ($r) => $r->status->isGranted())->sum(fn ($r) => $r->grantedAmount());
        $waiting = $rows->filter(fn ($r) => in_array($r->status, [RequestStatus::Pending, RequestStatus::Returned], true))->sum('amount');
        $open = $rows->first(fn ($r) => in_array($r->status, [RequestStatus::Pending, RequestStatus::Returned], true));

        return [
            'netSalary' => $employee->netSalary(),
            'limit' => $limit,
            'limitMonths' => AssistanceRequest::LIMIT_MONTHS,
            'givenThisYear' => round($given, 3),
            'waiting' => round((float) $waiting, 3),
            'remaining' => max(0.0, round($limit - $given - $waiting, 3)),
            'openRequest' => $open?->request_no,
            'canRequest' => $open === null,
        ];
    }
}
