<?php

namespace App\Models;

use App\Casts\Money;
use App\Enums\RequestStatus;
use App\Models\Concerns\HasRequestWorkflow;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Allowances (medical, transport, travel, air ticket), overtime, leave
 * encashment, notice pay and end-of-service: one table, told apart by `kind`,
 * because they are all asked for, decided and paid the same way.
 */
class EntitlementRequest extends Model
{
    use HasRequestWorkflow;

    /** kind => [number prefix, subcategory it is booked under] */
    public const KINDS = [
        'leaveEncashment' => ['LER', 'Leave Encashment Request'],
        'overtime' => ['OTR', 'Overtime Pay Request'],
        'medical' => ['MAR', 'Medical Allowance Request'],
        'transport' => ['TRA', 'Transport Allowance'],
        'travel' => ['TAR', 'Travel Allowance Request'],
        'airTicket' => ['ATA', 'Air Ticket Allowance Request'],
        'notice' => ['NPR', 'Notice Pay Request'],
        'endOfService' => ['EOS', 'End of Service Request'],
    ];

    /** Requests made on an invoice: they start with the invoice analysis. */
    public const INVOICE_KINDS = ['medical', 'travel', 'airTicket', 'transport'];

    /** A month of pay divided into days, and a working day into hours. */
    public const DAYS_IN_MONTH = 30;

    public const HOURS_IN_DAY = 8;

    protected $guarded = ['id', 'request_no', 'entitlement_no'];

    protected function casts(): array
    {
        return [
            'request_date' => 'date:Y-m-d',
            'travel_date' => 'date:Y-m-d',
            'amount' => Money::class,
            'insurance_covered' => Money::class,
            'days' => 'float',
            'hours' => 'float',
            'year' => 'integer',
            'invoice' => 'array',
            'risk' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (EntitlementRequest $request): void {
            $request->request_no ??= Numbering::code(self::KINDS[$request->kind][0]);
        });
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public static function needsInvoice(string $kind): bool
    {
        return in_array($kind, self::INVOICE_KINDS, true);
    }

    /* ------------------------------------------------------- amounts */

    /** One ordinary hour of a monthly salary. */
    public static function hourlyRate(float $salary): float
    {
        return round($salary / self::DAYS_IN_MONTH / self::HOURS_IN_DAY, 3);
    }

    public static function overtimeAmount(float $salary, float $hours): float
    {
        return round(self::hourlyRate($salary) * $hours, 3);
    }

    public static function encashmentAmount(float $salary, float $days): float
    {
        return round($salary / self::DAYS_IN_MONTH * $days, 3);
    }

    public function requestedAmount(): float
    {
        return (float) $this->amount;
    }

    public function defaultBooking(): array
    {
        return [
            'expense_type' => 'Employee Expenses',
            'category' => 'Allowance Request',
            'subcategory' => self::KINDS[$this->kind][1],
        ];
    }

    /** Approved but not yet paid reads "Awaiting Payment" on this list. */
    public function statusLabel(): string
    {
        return match ($this->status) {
            RequestStatus::Approved => 'Awaiting Payment',
            RequestStatus::Paid => 'Approved',
            default => $this->status->value,
        };
    }

    /** An approved request takes its standard number: ENT-009. */
    public function whenApproved(): void
    {
        $this->entitlement_no ??= Numbering::code('ENT');
    }

    /**
     * Leave paid out instead of taken comes off the balance like leave taken,
     * so paying an encashment files it on the leave record.
     */
    public function whenPaid(): void
    {
        if ($this->kind !== 'leaveEncashment' || ! $this->days) {
            return;
        }

        Leave::create([
            'employee_id' => $this->employee_id,
            'category' => 'Regular Leave',
            'type' => $this->leave_type ?: 'Annual Leave',
            'year' => $this->year ?: (int) $this->request_date->format('Y'),
            'days' => $this->days,
            'encashment_no' => $this->entitlement_no ?? $this->request_no,
            'reason' => 'Leave encashment '.$this->request_no,
            'status' => Leave::ENCASHED_PAID,
            'stage' => 'management',
            'decided_by' => $this->paid_by,
            'decided_at' => now(),
        ]);
    }
}
