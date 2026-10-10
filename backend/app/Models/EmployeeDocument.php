<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A paper on an employee's file.
 *
 * Its status is worked out, never stored: Archived once a newer copy of the
 * same paper is filed, otherwise Expired / Expiring Soon / Active off the
 * expiry date - so a paper cannot claim to be valid on a day its own expiry
 * has passed.
 */
class EmployeeDocument extends Model
{
    /** Papers chased three months before they lapse. */
    public const EXPIRING_DAYS = 90;

    public const IDENTITY_TYPES = ['National ID', 'Passport', 'Residence Card'];

    public const LAWYER_TYPE = 'Law Practice License';

    public const MEMBERSHIP_TYPE = 'Professional Membership Card';

    /** Papers a person cannot work without: lapsed past the grace period, access is held. */
    public const CRITICAL_TYPES = ['Law Practice License', 'Residence Card'];

    public const COMMON_TYPES = [
        'CV', 'University Degree', 'Experience Certificate', 'Training Certificate',
        'Appointment Decision', 'Promotion Decision', 'Transfer Decision', 'Warning Decision',
        'Termination Decision', 'Committee Formation Decision',
        'Other Identity Document', 'Other Professional Licence', 'Other Qualification', 'Other Decision', 'Other',
    ];

    /** Held one at a time, so a new one archives the old (passport v2 archives v1). */
    public const VERSIONED_TYPES = ['National ID', 'Passport', 'Residence Card', 'Law Practice License'];

    /** The record fields a paper stands for: it can only be filed once they are saved. */
    public const RELATED_RECORD = [
        'National ID' => ['civil_id', 'id_expiry'],
        'Residence Card' => ['civil_id', 'id_expiry'],
        'Passport' => ['passport_number', 'passport_expiry'],
        'Work Permit' => ['work_permit_no', 'work_permit_expiry'],
        'Law Practice License' => ['lawyer_card_no', 'lawyer_card_expiry'],
    ];

    protected $guarded = ['id'];

    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return [
            'expiry' => 'date:Y-m-d',
            'uploaded_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public static function allTypes(): array
    {
        return [...self::IDENTITY_TYPES, self::LAWYER_TYPE, self::MEMBERSHIP_TYPE, ...self::COMMON_TYPES];
    }

    public static function expires(string $type): bool
    {
        return array_key_exists($type, self::RELATED_RECORD);
    }

    /** Status read against the rest of the employee's file. */
    public function statusAmong(iterable $papers): string
    {
        if (in_array($this->type, self::VERSIONED_TYPES, true)) {
            foreach ($papers as $other) {
                if ($other->id !== $this->id && $other->type === $this->type && $this->isOlderThan($other)) {
                    return 'Archived';
                }
            }
        }

        if (! $this->expiry) {
            return 'Active';
        }

        $days = CarbonImmutable::today()->diffInDays($this->expiry, false);

        return match (true) {
            $days < 0 => 'Expired',
            $days <= self::EXPIRING_DAYS => 'Expiring Soon',
            default => 'Active',
        };
    }

    private function isOlderThan(EmployeeDocument $other): bool
    {
        return $other->uploaded_at->gt($this->uploaded_at)
            || ($other->uploaded_at->eq($this->uploaded_at) && $other->id > $this->id);
    }
}
