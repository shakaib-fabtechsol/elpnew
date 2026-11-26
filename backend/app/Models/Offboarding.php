<?php

namespace App\Models;

use App\Support\Numbering;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One employee's End of Service case.
 *
 *   Pending Approval -> In Progress -> Completed
 *                    \-> Rejected     (and Cancelled from either open state)
 *
 * While In Progress the notice runs, the checklist is worked through and the
 * assets come back; completing it is what makes the employee Inactive and
 * takes their access away.
 */
class Offboarding extends Model
{
    public const TYPES = ['Resignation', 'Termination', 'End of Contract', 'Retirement'];

    public const NOTICE_MODES = ['Served', 'Waived', 'Paid in lieu'];

    public const PENDING = 'Pending Approval';

    public const IN_PROGRESS = 'In Progress';

    public const COMPLETED = 'Completed';

    public const REJECTED = 'Rejected';

    public const CANCELLED = 'Cancelled';

    public const STATUSES = [self::PENDING, self::IN_PROGRESS, self::COMPLETED, self::REJECTED, self::CANCELLED];

    /** A case still under way: at most one of these per employee. */
    public const OPEN = [self::PENDING, self::IN_PROGRESS];

    protected $guarded = ['id', 'case_no'];

    protected function casts(): array
    {
        return [
            'notice_date' => 'date:Y-m-d',
            'last_working_date' => 'date:Y-m-d',
            'notice_days' => 'integer',
            'decided_at' => 'datetime',
            'completed_at' => 'datetime',
            'exit_interview' => 'array',
            'settlement' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Offboarding $case): void {
            $case->case_no ??= Numbering::yearly('OFF', 3);
        });
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class)->withTrashed();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(OffboardingTask::class)->orderBy('sort');
    }

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN, true);
    }

    /** Whose decision the leaving was, in the words the employee record uses. */
    public function decisionMaker(): string
    {
        return $this->type === 'Resignation' ? 'Employee Decision' : 'Management Decision';
    }

    /** Who started it: the employee (a resignation) or the firm. */
    public function initiatedByParty(): string
    {
        return $this->type === 'Resignation' ? 'Employee' : 'Company';
    }
}
