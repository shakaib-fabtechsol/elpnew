<?php

namespace App\Models;

use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * An instruction issued to a group. Never edited once out: a correction is a
 * new circular that supersedes it, so the original and everyone who
 * acknowledged it stay exactly as they were.
 */
class Circular extends Model
{
    public const ACTIVE = 'Active';

    public const COMPLETED = 'Completed';

    public const CANCELLED = 'Cancelled';

    public const TARGET_GROUPS = ['All Employees', 'Lawyers', 'Administration', 'Partners', 'Accounting'];

    protected $guarded = ['id', 'circular_no'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d'];
    }

    protected static function booted(): void
    {
        static::creating(function (Circular $circular): void {
            $circular->circular_no ??= Numbering::yearly('CIR', 3, (int) $circular->date->format('Y'));
        });
    }

    public function acknowledgements(): HasMany
    {
        return $this->hasMany(CircularAcknowledgement::class);
    }

    public function supersedes(): BelongsTo
    {
        return $this->belongsTo(Circular::class, 'supersedes_id');
    }

    public function supersededBy(): HasOne
    {
        return $this->hasOne(Circular::class, 'supersedes_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /** Whether a person is among those this circular was issued to. */
    public function isFor(Employee $employee): bool
    {
        $groupMatches = match ($this->target_group) {
            'All Employees' => true,
            'Lawyers' => $employee->occupation === 'Lawyer' || $employee->practice_level !== null,
            'Partners' => $employee->department === 'Partner',
            'Administration' => $employee->department === 'Administration',
            'Accounting' => $employee->occupation === 'Accountant',
            default => false,
        };

        return $groupMatches && ($this->branch === 'general' || $this->branch === $employee->branch);
    }
}
