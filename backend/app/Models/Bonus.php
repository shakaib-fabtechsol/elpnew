<?php

namespace App\Models;

use App\Casts\Money;
use App\Enums\RequestStatus;
use App\Models\Concerns\HasRequestWorkflow;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;

class Bonus extends Model
{
    use HasRequestWorkflow;

    public const SUBCATEGORIES = [
        'Performance and Excellence',
        'Completion of a Case or Task',
        'Collection',
        'Business Development',
        'Annual Bonus',
        'Exceptional Bonus',
        'Other',
    ];

    /** Anything that is not one of the reasons above has to say what it was. */
    public const OTHER = 'Other';

    protected $guarded = ['id', 'request_no'];

    protected function casts(): array
    {
        return [
            'recorded_on' => 'date:Y-m-d',
            'amount' => Money::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Bonus $bonus): void {
            $bonus->request_no ??= Numbering::code('BON');
        });
    }

    public function requestedAmount(): float
    {
        return (float) $this->amount;
    }

    public function defaultBooking(): array
    {
        return ['expense_type' => 'Employee Expenses', 'category' => 'Bonus', 'subcategory' => $this->bonus_subcategory];
    }

    /** A paid bonus reads "Disbursed" on its list. */
    public function statusLabel(): string
    {
        return $this->status === RequestStatus::Paid ? 'Disbursed' : $this->status->value;
    }
}
