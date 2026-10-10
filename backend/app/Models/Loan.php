<?php

namespace App\Models;

use App\Casts\Money;
use App\Enums\Decision;
use App\Enums\RequestStatus;
use App\Models\Concerns\HasRequestWorkflow;
use App\Services\LoanSchedule;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Money drawn once and repaid over months. */
class Loan extends Model
{
    use HasRequestWorkflow;

    public const NEW_LOAN = 'New Loan';

    public const INCREASE = 'Loan Amount Increase';

    /**
     * The most a person may owe on loans at once, in months of net salary.
     * The firm has not set this down yet; one figure here, to change in one
     * place (the app uses the same: LOAN_LIMIT_MONTHS).
     */
    public const LIMIT_MONTHS = 10;

    protected $guarded = ['id', 'request_no'];

    protected function casts(): array
    {
        return [
            'requested_on' => 'date:Y-m-d',
            'loan_amount' => Money::class,
            'merged' => Money::class,
            'monthly' => Money::class,
            'approved_monthly' => Money::class,
            'first_due' => 'date:Y-m-d',
            'disbursement_date' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Loan $loan): void {
            $loan->request_no ??= Numbering::code('LNR');
        });
    }

    public function payments(): HasMany
    {
        return $this->hasMany(LoanPayment::class)->orderBy('due_date');
    }

    public function requestedAmount(): float
    {
        return (float) $this->loan_amount;
    }

    public function defaultBooking(): array
    {
        return ['expense_type' => 'Employee Expenses', 'category' => 'Loan', 'subcategory' => $this->kind];
    }

    public function statusLabel(): string
    {
        return match (true) {
            $this->status === RequestStatus::Paid && $this->remaining() <= 0 => 'Completed',
            $this->status === RequestStatus::Paid => 'Active',
            $this->status === RequestStatus::Approved && $this->decision === Decision::Partial => 'Partial Approval',
            $this->status === RequestStatus::Approved => 'Full Approval',
            default => $this->status->value,
        };
    }

    /* ----------------------------------------------------------- schedule */

    /** What the loan repays: what was granted plus anything merged into it. */
    public function total(): float
    {
        return round($this->grantedAmount() + (float) $this->merged, 3);
    }

    public function installment(): float
    {
        return (float) ($this->approved_monthly ?? $this->monthly);
    }

    public function scheduleRows(): array
    {
        return LoanSchedule::rows(
            $this->total(),
            $this->installment(),
            $this->first_due?->format('Y-m-d'),
            $this->payments->map(fn (LoanPayment $p) => [
                'due_date' => $p->due_date->format('Y-m-d'),
                'amount' => $p->amount,
                'paid_on' => $p->paid_on?->format('Y-m-d'),
                'deferred' => $p->deferred,
            ]),
        );
    }

    public function paid(): float
    {
        return round((float) $this->payments->sum('amount'), 3);
    }

    public function remaining(): float
    {
        return max(round($this->total() - $this->paid(), 3), 0.0);
    }

    /** Money in hand: only a paid-out loan is owed. */
    public function isOwed(): bool
    {
        return $this->status === RequestStatus::Paid && $this->remaining() > 0;
    }
}
