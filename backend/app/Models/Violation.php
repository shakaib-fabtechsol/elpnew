<?php

namespace App\Models;

use App\Casts\Money;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A violation and what came of it: recorded, answered, decided, appealed,
 * settled - five stages filling one record. Numbered (VIO-003) only once a
 * penalty is issued; a case that ends in nothing never takes a number.
 */
class Violation extends Model
{
    public const STAGES = ['violation', 'response', 'decision', 'appeal', 'outcome'];

    public const TYPES = ['Attendance', 'Unauthorized Absence', 'Negligence', 'Breach of Instructions', 'Workplace Conduct', 'Breach of Confidentiality', 'Misuse of Office Assets', 'Other'];

    public const INVESTIGATION_RESULTS = ['Guilty', 'Not Guilty'];

    public const PENALTIES = ['Written Notice', 'Written Warning', 'Final Warning', 'Financial Deduction', 'Suspension from Work', 'Termination of Employment', 'No Penalty'];

    public const DEDUCTION_PENALTY = 'Financial Deduction';

    public const NO_PENALTY = 'No Penalty';

    public const APPEAL_OUTCOMES = [
        'Reject Appeal and Uphold Decision',
        'Partially Accept Appeal and Modify Penalty',
        'Accept Appeal and Cancel Penalty',
    ];

    public const PARTIAL_OUTCOME = 'Partially Accept Appeal and Modify Penalty';

    public const CANCELLING_OUTCOME = 'Accept Appeal and Cancel Penalty';

    protected $guarded = ['id', 'violation_no'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'investigation_start' => 'date:Y-m-d',
            'penalty_date' => 'date:Y-m-d',
            'appeal_date' => 'date:Y-m-d',
            'outcome_date' => 'date:Y-m-d',
            'acknowledged_at' => 'datetime',
            'deduction_amount' => Money::class,
            'modified_deduction_amount' => Money::class,
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /** Who approved the penalty, and who approved the appeal's outcome. */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function outcomeApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'outcome_approved_by');
    }

    /** Which stages are done, and the first one still to do. */
    public function stagesDone(): array
    {
        return [
            'violation' => true,
            'response' => (bool) $this->response,
            'decision' => (bool) $this->penalty_type,
            'appeal' => (bool) $this->appeal_grounds,
            'outcome' => (bool) $this->appeal_outcome,
        ];
    }

    public function nextStage(): string
    {
        foreach ($this->stagesDone() as $stage => $done) {
            if (! $done) {
                return $stage;
            }
        }

        return 'outcome';
    }

    public function assignNumber(): void
    {
        $this->violation_no ??= Numbering::code('VIO');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->role->seesEveryone() ? $query : $query->where('employee_id', $user->employee_id);
    }
}
