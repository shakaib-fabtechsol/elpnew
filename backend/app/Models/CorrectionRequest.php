<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A correction asked for on an employee's record. It never changes the record
 * by itself: it waits, with what each field says now and should say, until
 * management approves it - and only then is the record updated.
 */
class CorrectionRequest extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
