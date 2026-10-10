<?php

namespace App\Models;

use App\Casts\Money;
use App\Enums\Decision;
use App\Enums\RequestStatus;
use App\Models\Concerns\HasRequestWorkflow;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;

/** An advance against the employee's own salary, deducted from one month. */
class SalaryAdvance extends Model
{
    use HasRequestWorkflow;

    public const PURPOSES = ['Emergency Case', 'Education Expenses', 'Medical Expenses', 'Family Expenses', 'Other (Please specify)'];

    public const OTHER_PURPOSE = 'Other (Please specify)';

    public const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    protected $guarded = ['id', 'request_no'];

    protected function casts(): array
    {
        return [
            'requested_on' => 'date:Y-m-d',
            'amount' => Money::class,
            'deduct_year' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (SalaryAdvance $advance): void {
            $advance->request_no ??= Numbering::yearly('SA', 5, (int) $advance->requested_on->format('Y'));
        });
    }

    public function requestedAmount(): float
    {
        return (float) $this->amount;
    }

    public function defaultBooking(): array
    {
        return ['expense_type' => 'Employee Expenses', 'category' => 'Salary', 'subcategory' => 'Salary Advance'];
    }

    /** "Fully Approved" / "Partially Approved" read better than "Approved" here. */
    public function statusLabel(): string
    {
        return match (true) {
            $this->status === RequestStatus::Approved && $this->decision === Decision::Partial => 'Partially Approved',
            $this->status === RequestStatus::Approved => 'Approved',
            default => $this->status->value,
        };
    }

    /** The month the money comes back out of, as a sortable number. */
    public function deductionIndex(): int
    {
        return $this->deduct_year * 12 + array_search($this->deduct_month, self::MONTHS, true);
    }
}
