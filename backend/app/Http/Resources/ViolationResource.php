<?php

namespace App\Http\Resources;

use App\Models\RequestEvent;
use Illuminate\Http\Request;

class ViolationResource extends ApiResource
{
    protected array $except = ['approved_by', 'outcome_approved_by'];

    protected function extra(Request $request): array
    {
        return [
            'stages_done' => $this->stagesDone(),
            'next_stage' => $this->nextStage(),
            'employee' => $this->whenLoaded('employee', fn () => ['id' => $this->employee->id, 'empNo' => $this->employee->emp_no, 'name' => $this->employee->name]),
            // Names, as the list's Approval & Notification column reads them.
            'approved_by' => $this->whenLoaded('approver', fn () => $this->approver?->name),
            'outcome_approved_by' => $this->whenLoaded('outcomeApprover', fn () => $this->outcomeApprover?->name),
            // The day the decision went to the employee: when it was logged.
            'approved_at' => $this->approved_by
                ? RequestEvent::where('subject_type', $this->getMorphClass())->where('subject_id', $this->id)
                    ->where('action', 'like', 'Penalty decided%')->latest('id')->first()?->created_at?->toIso8601String()
                : null,
        ];
    }
}
