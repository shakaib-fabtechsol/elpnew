<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\HasRequestWorkflow;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;

/** Money the firm gives an employee to help with something in their life. */
class AssistanceRequest extends Model
{
    use HasRequestWorkflow;

    /** Each kind of help, with the paper the office wants to see with it. */
    public const TYPES = [
        'Social Assistance' => 'Marriage contract, birth certificate or death certificate',
        'Medical Assistance' => 'Medical report or hospital invoice',
        'Education Assistance' => 'School or university fee invoice',
        'Other Assistance' => 'Any document that supports the request',
    ];

    public const BENEFICIARIES = ['Employee (Self)', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Other Family Member'];

    /** The most granted in a request, in months of net salary (app: ASSISTANCE_LIMIT_MONTHS). */
    public const LIMIT_MONTHS = 2;

    protected $guarded = ['id', 'request_no'];

    protected function casts(): array
    {
        return [
            'request_date' => 'date:Y-m-d',
            'amount' => Money::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (AssistanceRequest $request): void {
            $request->request_no ??= Numbering::code('ASR');
        });
    }

    public function requestedAmount(): float
    {
        return (float) $this->amount;
    }

    public function defaultBooking(): array
    {
        return ['expense_type' => 'Employee Expenses', 'category' => 'Assistance', 'subcategory' => $this->assistance_type];
    }
}
