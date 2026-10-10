<?php

namespace App\Models\Concerns;

use App\Casts\Money;
use App\Enums\Decision;
use App\Enums\RequestStatus;
use App\Models\Employee;
use App\Models\RequestEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * A request that goes Submit -> Management Decision -> Financial Department
 * Actions: the columns added by `requestWorkflow()` and what is shared about
 * reading them. The moves themselves are made by App\Services\RequestWorkflow.
 *
 * @property RequestStatus $status
 * @property ?Decision $decision
 */
trait HasRequestWorkflow
{
    public function initializeHasRequestWorkflow(): void
    {
        $this->mergeCasts([
            'status' => RequestStatus::class,
            'decision' => Decision::class,
            'approved_amount' => Money::class,
            'decided_at' => 'datetime',
            'payment_date' => 'date:Y-m-d',
            'paid_at' => 'datetime',
        ]);
    }

    /** What was asked for, in rials. */
    abstract public function requestedAmount(): float;

    /** How the payment is booked unless the financial department says otherwise. */
    abstract public function defaultBooking(): array;

    /** What is paid: what management granted, or what was asked for. */
    public function grantedAmount(): float
    {
        return (float) ($this->approved_amount ?? $this->requestedAmount());
    }

    /** Called once a decision has granted the request (number it, etc.). */
    public function whenApproved(): void {}

    /** Called once the money has gone out. */
    public function whenPaid(): void {}

    /** How each module words a status on screen; the stored value by default. */
    public function statusLabel(): string
    {
        return $this->status->value;
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function events(): MorphMany
    {
        return $this->morphMany(RequestEvent::class, 'subject')->orderByDesc('id');
    }

    /** Admin and accounting see every request; anyone else only their own. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->seesEveryone()
            ? $query
            : $query->where('employee_id', $user->employee_id);
    }

    /** ?status=Pending,Returned */
    public function scopeWithStatus(Builder $query, ?string $statuses): Builder
    {
        return $statuses ? $query->whereIn('status', explode(',', $statuses)) : $query;
    }
}
