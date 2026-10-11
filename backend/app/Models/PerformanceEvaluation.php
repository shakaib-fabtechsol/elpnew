<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One periodic evaluation: a score from 1 to 5 on each criterion, and the words that go with them. */
class PerformanceEvaluation extends Model
{
    /** What an employee of the firm is evaluated on. */
    public const CRITERIA = [
        'quality' => 'Quality of Work',
        'productivity' => 'Productivity & Deadlines',
        'knowledge' => 'Professional Knowledge',
        'communication' => 'Communication',
        'teamwork' => 'Teamwork',
        'reliability' => 'Attendance & Reliability',
        'initiative' => 'Initiative & Development',
    ];

    public const STATUSES = ['Draft', 'Final'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'scores' => 'array',
            'overall' => 'float',
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    /** 4.5+ Outstanding ... below 2 Unsatisfactory. */
    public static function rating(float $overall): string
    {
        return match (true) {
            $overall >= 4.5 => 'Outstanding',
            $overall >= 3.75 => 'Exceeds Expectations',
            $overall >= 3.0 => 'Meets Expectations',
            $overall >= 2.0 => 'Needs Improvement',
            default => 'Unsatisfactory',
        };
    }
}
