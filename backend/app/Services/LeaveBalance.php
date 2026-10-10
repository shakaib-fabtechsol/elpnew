<?php

namespace App\Services;

use App\Models\Leave;

/**
 * What is left of a leave type in a year - counted off the approved and
 * encashed records every time, never stored, so a balance cannot go stale
 * the moment a request is approved somewhere else.
 *
 * Nothing carries over: a year that has ended reads as fully used, which is
 * also what makes advance leave against next year the only way to be granted
 * days once this year's are gone.
 */
final class LeaveBalance
{
    /** null for types whose length depends on the case ("Up to 182 Days"). */
    public static function for(int $employeeId, string $type, int $year, ?int $exceptLeaveId = null): ?array
    {
        $allowance = Leave::allowanceDays($type);
        if ($allowance === null) {
            return null;
        }

        if ($year < (int) now()->format('Y')) {
            return ['allowance' => $allowance, 'used' => $allowance, 'remaining' => 0, 'expired' => true];
        }

        $used = Leave::query()
            ->where('employee_id', $employeeId)
            ->where('type', $type)
            ->where('year', $year)
            ->whereIn('status', ['Approved', Leave::ENCASHED_PAID])
            ->when($exceptLeaveId, fn ($q) => $q->whereKeyNot($exceptLeaveId))
            ->get()
            ->sum(fn (Leave $leave) => $leave->countedDays());

        return [
            'allowance' => $allowance,
            'used' => $used,
            'remaining' => max($allowance - $used, 0),
            'expired' => false,
        ];
    }

    /** Advance leave is only possible once this year's annual leave is gone. */
    public static function canTakeAdvance(int $employeeId, int $year): bool
    {
        $balance = self::for($employeeId, 'Annual Leave', $year);

        return $balance !== null && $balance['remaining'] <= 0;
    }

    /** Approved leave covering today - not a request, not a typed status. */
    public static function onLeaveToday(int $employeeId): bool
    {
        $today = now()->format('Y-m-d');

        return Leave::query()
            ->where('employee_id', $employeeId)
            ->where('status', 'Approved')
            ->whereDate('starts_on', '<=', $today)
            ->whereDate('ends_on', '>=', $today)
            ->exists();
    }
}
