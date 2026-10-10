<?php

namespace App\Services;

use Carbon\CarbonImmutable;

/**
 * The plan a loan is repaid on, worked out from three figures - the total,
 * the monthly installment and the day the first one falls due - plus the
 * payments actually made. Nothing about the schedule is stored, so it cannot
 * drift out of step with the amounts it comes from.
 *
 * Same rules as the app (src/pages/employees/loanData.js):
 * - the last installment is whatever is left after the whole ones;
 * - a schedule starting on a month's last day stays on the last day of every
 *   month (30 Sep -> 31 Oct); any other day is kept, shortened only where a
 *   month is too short to hold it.
 */
final class LoanSchedule
{
    /** ['months' => n, 'installment' => x, 'last' => y] */
    public static function plan(float $total, float $monthly): array
    {
        if ($total <= 0 || $monthly <= 0) {
            return ['months' => 0, 'installment' => $monthly, 'last' => 0.0];
        }

        $months = (int) ceil(round($total / $monthly, 6));
        $last = round($total - ($months - 1) * $monthly, 3);

        return ['months' => $months, 'installment' => $monthly, 'last' => $last];
    }

    /** The day installment `$index` (0-based) falls due, as Y-m-d. */
    public static function dueDate(string $first, int $index): string
    {
        $start = CarbonImmutable::parse($first);
        $onMonthEnd = $start->day === $start->daysInMonth;
        $target = $start->startOfMonth()->addMonthsNoOverflow($index);
        $day = $onMonthEnd ? $target->daysInMonth : min($start->day, $target->daysInMonth);

        return $target->setDay($day)->format('Y-m-d');
    }

    /** The last day of the month a repayment starts in: "November 2026" -> 2026-11-30. */
    public static function monthEnd(string $monthLabel): ?string
    {
        try {
            return CarbonImmutable::createFromFormat('F Y d', $monthLabel.' 01')->endOfMonth()->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Every installment with what was paid against it.
     *
     * @param  iterable<array{due_date:string, amount:float, paid_on:?string, deferred:bool}>  $payments
     * @return list<array<string, mixed>>
     */
    public static function rows(float $total, float $monthly, ?string $first, iterable $payments = []): array
    {
        $plan = self::plan($total, $monthly);
        if (! $plan['months'] || ! $first) {
            return [];
        }

        $byDue = [];
        foreach ($payments as $payment) {
            $byDue[(string) $payment['due_date']] = $payment;
        }

        $rows = [];
        $paidSoFar = 0.0;
        for ($i = 0; $i < $plan['months']; $i++) {
            $due = self::dueDate($first, $i);
            $installment = $i === $plan['months'] - 1 ? $plan['last'] : $plan['installment'];
            $payment = $byDue[$due] ?? null;
            $paid = $payment ? (float) $payment['amount'] : 0.0;
            $paidSoFar += $paid;

            $rows[] = [
                'no' => $i + 1,
                'of' => $plan['months'],
                'due' => $due,
                'installment' => round($installment, 3),
                'paid' => round($paid, 3),
                'remaining' => round($total - $paidSoFar, 3),
                'status' => match (true) {
                    $payment && $payment['deferred'] => 'Deferred',
                    $paid >= $installment => 'Paid',
                    $paid > 0 => 'Partially Paid',
                    default => 'Pending',
                },
                'paymentDate' => $payment['paid_on'] ?? '',
            ];
        }

        return $rows;
    }
}
