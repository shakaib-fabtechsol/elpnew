<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\HasRequestWorkflow;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;

/**
 * A commission agreed with an employee: a standing rate on a client's legal
 * fees over a period, or a rate on one paid invoice. The commission itself is
 * the fees times the rate; `amount` holds the figure agreed for payment.
 */
class Commission extends Model
{
    use HasRequestWorkflow;

    public const FIXED = 'Fixed Commission';

    public const INVOICE_LINKED = 'Invoice-Linked Commission';

    public const CLASSIFICATIONS = ['Partners', 'Lawyers', 'Consultants', 'Employees'];

    protected $guarded = ['id', 'commission_no'];

    protected function casts(): array
    {
        return [
            'rate' => 'float',
            'period_from' => 'date:Y-m-d',
            'period_to' => 'date:Y-m-d',
            'amount' => Money::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Commission $commission): void {
            $commission->commission_no ??= Numbering::yearly('COM');
        });
    }

    public function requestedAmount(): float
    {
        return (float) ($this->amount ?? 0);
    }

    public function defaultBooking(): array
    {
        return ['expense_type' => 'Employee Expenses', 'category' => 'Commission', 'subcategory' => $this->type];
    }
}
