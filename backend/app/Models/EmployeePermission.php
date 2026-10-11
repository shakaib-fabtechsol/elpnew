<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What one employee may see and do, once somebody has set it. */
class EmployeePermission extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'grants' => 'array',
            'departments' => 'array',
            'approval_limit' => Money::class,
            'payment_limit' => Money::class,
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
