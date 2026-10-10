<?php

namespace App\Models;

use App\Support\Numbering;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Leave asked for, decided, or paid out. The employee asks, the relevant
 * department reviews, management decides.
 */
class Leave extends Model
{
    public const ENCASHED_PAID = 'Encashed – Paid';

    /** Category => [type => entitlement as the law states it]. */
    public const TYPES = [
        'Regular Leave' => [
            'Annual Leave' => '30 Days',
            'Sick Leave' => 'Up to 182 Days',
            'Unpaid Leave' => 'As Approved',
        ],
        'Family Leave' => [
            'Paternity Leave' => '7 Days',
            'Maternity Leave' => '98 Days',
            'Marriage Leave' => '3 Days',
            'Bereavement Leave' => '2 / 3 / 10 Days',
            'Widowhood Leave' => '130 / 14 Days',
        ],
        'Special Leave' => [
            'Hajj Leave' => '15 Days',
            'Study / Examination Leave' => 'Up to 15 Days',
            'Patient Escort Leave' => '15 Days',
        ],
    ];

    protected $guarded = ['id', 'leave_no'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'year' => 'integer',
            'days' => 'float',
            'department_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Leave $leave): void {
            $leave->leave_no ??= Numbering::code('LEV');
        });
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function replacement(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'replacement_employee_id');
    }

    /** Who reviewed it for the department, and who gave the final answer. */
    public function departmentReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'department_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public static function categoryOf(string $type): ?string
    {
        foreach (self::TYPES as $category => $types) {
            if (array_key_exists($type, $types)) {
                return $category;
            }
        }

        return null;
    }

    public static function entitlementOf(string $type): string
    {
        $category = self::categoryOf($type);

        return $category ? self::TYPES[$category][$type] : '';
    }

    /** "30 Days" counts down; "Up to 182 Days" and the like depend on the case. */
    public static function allowanceDays(string $type): ?int
    {
        return preg_match('/^(\d+) Days?$/', self::entitlementOf($type), $m) ? (int) $m[1] : null;
    }

    /** Inclusive: leaving on the 1st and back on the 5th is five days. */
    public static function daysBetween(?string $from, ?string $to): int
    {
        if (! $from || ! $to) {
            return 0;
        }
        $days = CarbonImmutable::parse($from)->diffInDays(CarbonImmutable::parse($to), false) + 1;

        return max((int) $days, 0);
    }

    /** The days this record counts for: its dates, or the days encashed. */
    public function countedDays(): float
    {
        return $this->status === self::ENCASHED_PAID
            ? (float) $this->days
            : self::daysBetween($this->starts_on?->format('Y-m-d'), $this->ends_on?->format('Y-m-d'));
    }

    /** Taken now against next year's annual leave. */
    public function isAdvance(): bool
    {
        return $this->starts_on !== null && $this->year > (int) $this->starts_on->format('Y');
    }

    public function workflowLabel(): string
    {
        return match (true) {
            $this->status === self::ENCASHED_PAID => 'Leave Encashment · '.($this->encashment_no ?: 'Paid'),
            $this->status === 'Approved' => 'Approved by Management',
            $this->status === 'Rejected' => 'Rejected',
            $this->stage === 'management' => 'Pending Management Approval',
            default => 'Pending Department Approval',
        };
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->seesEveryone() ? $query : $query->where('employee_id', $user->employee_id);
    }
}
