<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An item of the firm's equipment issued to an employee.
 *
 * Assigned while the employee holds it; Returned or Disposed once it comes
 * back or is written off, with the date it happened. Rows are kept for good,
 * so the register is the item's history as well as what is out today.
 */
class EmployeeAsset extends Model
{
    public const TYPES = ['Car', 'Computer / Laptop', 'Mobile Phone', 'Work ID Card'];

    public const ASSIGNED = 'Assigned';

    public const RETURNED = 'Returned';

    public const DISPOSED = 'Disposed';

    public const STATUSES = [self::ASSIGNED, self::RETURNED, self::DISPOSED];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date:Y-m-d',
            'return_date' => 'date:Y-m-d',
            'disposal_date' => 'date:Y-m-d',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** Items still with the person - what End of Service has to see back. */
    public function scopeOutstanding(Builder $query): Builder
    {
        return $query->where('status', self::ASSIGNED);
    }

    /** Whoever holds this asset number today, if anybody but the given row. */
    public static function heldElsewhere(string $number, ?int $exceptId = null): ?self
    {
        return self::outstanding()
            ->whereRaw('lower(asset_number) = ?', [mb_strtolower(trim($number))])
            ->when($exceptId, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->with('employee:id,name')
            ->first();
    }
}
