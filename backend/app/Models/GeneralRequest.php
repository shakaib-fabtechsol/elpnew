<?php

namespace App\Models;

use App\Support\Numbering;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** General requests, grievances and complaints - asked, then approved or refused. */
class GeneralRequest extends Model
{
    /** kind => [title, number prefix, the types it can be about] */
    public const KINDS = [
        'general' => ['General Request', 'GR', ['Suggestions', 'Report', 'Administrative Request', 'Other Requests']],
        'grievance' => ['Grievance', 'GRV', ['Pay & Benefits', 'Working Conditions', 'Workload & Hours', 'Management Decision', 'Other Grievance']],
        'complaint' => ['Complaint', 'CMP', ['Harassment', 'Discrimination', 'Misconduct', 'Health & Safety', 'Other Complaint']],
    ];

    public const COMMENT_LIMIT = 500;

    public const DECISION_COMMENT_LIMIT = 300;

    protected $guarded = ['id', 'request_no'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'decision_date' => 'date:Y-m-d',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (GeneralRequest $request): void {
            $request->request_no ??= Numbering::yearly(self::KINDS[$request->kind][1], 3, (int) $request->date->format('Y'));
        });
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->seesEveryone() ? $query : $query->where('employee_id', $user->employee_id);
    }
}
