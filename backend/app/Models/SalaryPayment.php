<?php

namespace App\Models;

use App\Casts\Money;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One month's salary: a request under REQ-004 until it is transferred, when it
 * takes the next salary number (SAL-007). The net is never stored - it is the
 * figures beside it, and a stored total could disagree with them.
 */
class SalaryPayment extends Model
{
    public const PENDING = 'Pending';

    public const TRANSFERRED = 'Transferred';

    public const REJECTED = 'Rejected';

    protected $guarded = ['id', 'request_no', 'salary_no'];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'year' => 'integer',
            'basic' => Money::class,
            'allowances' => Money::class,
            'loan_deducted' => Money::class,
            'advance_deducted' => Money::class,
            'administrative' => Money::class,
            'payment_date' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (SalaryPayment $payment): void {
            $payment->request_no ??= Numbering::code('REQ');
        });
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function gross(): float
    {
        return round((float) $this->basic + (float) $this->allowances, 3);
    }

    public function deductions(): float
    {
        return round((float) $this->loan_deducted + (float) $this->advance_deducted + (float) $this->administrative, 3);
    }

    public function net(): float
    {
        return round($this->gross() - $this->deductions(), 3);
    }

    public function transfer(): void
    {
        $this->salary_no ??= Numbering::code('SAL');
        $this->status = self::TRANSFERRED;
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->seesEveryone() ? $query : $query->where('employee_id', $user->employee_id);
    }
}
