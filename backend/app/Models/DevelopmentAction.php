<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One step of an employee's development plan: training, coaching, a corrective action, a recognition. */
class DevelopmentAction extends Model
{
    public const KINDS = ['Training', 'Coaching', 'Mentoring', 'Certification', 'Corrective Action', 'Recognition'];

    public const STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'];

    public const OPEN = ['Planned', 'In Progress'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['due_on' => 'date:Y-m-d', 'completed_at' => 'datetime'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
