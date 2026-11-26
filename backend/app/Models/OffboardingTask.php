<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One item of an End of Service clearance checklist, with who does it. */
class OffboardingTask extends Model
{
    public const PENDING = 'Pending';

    public const DONE = 'Done';

    public const NOT_APPLICABLE = 'Not Applicable';

    public const STATUSES = [self::PENDING, self::DONE, self::NOT_APPLICABLE];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['required' => 'boolean', 'completed_at' => 'datetime', 'sort' => 'integer'];
    }

    public function offboarding(): BelongsTo
    {
        return $this->belongsTo(Offboarding::class);
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /** Cleared: done, or set aside as not applying to this departure. */
    public function isCleared(): bool
    {
        return $this->status !== self::PENDING;
    }
}
