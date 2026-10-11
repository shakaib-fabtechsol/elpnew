<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Permissions held for a time: lent by a colleague, or granted temporarily. */
class PermissionDelegation extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'revoked_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function from(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'from_employee_id');
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    /** In force today: started, not ended, not revoked. */
    public function scopeActive(Builder $query): Builder
    {
        $today = now()->toDateString();

        return $query->whereNull('revoked_at')->whereDate('starts_on', '<=', $today)->whereDate('ends_on', '>=', $today);
    }

    public function state(): string
    {
        $today = now()->toDateString();

        return match (true) {
            $this->revoked_at !== null => 'Revoked',
            $this->ends_on->toDateString() < $today => 'Expired',
            $this->starts_on->toDateString() > $today => 'Scheduled',
            default => 'Active',
        };
    }
}
