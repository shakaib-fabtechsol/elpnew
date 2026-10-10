<?php

namespace App\Http\Resources;

use App\Models\Leave;
use Illuminate\Http\Request;

class LeaveResource extends ApiResource
{
    protected array $except = ['starts_on', 'ends_on', 'department_by', 'decided_by'];

    protected function extra(Request $request): array
    {
        return [
            // The app calls the dates from / to.
            'from' => $this->starts_on?->format('Y-m-d'),
            'to' => $this->ends_on?->format('Y-m-d'),
            'entitlement' => Leave::entitlementOf($this->type),
            'counted_days' => $this->countedDays(),
            'is_advance' => $this->isAdvance(),
            'type_label' => $this->isAdvance() ? 'Advance Annual Leave' : $this->type,
            'workflow_label' => $this->workflowLabel(),
            // Names, as the review sheet reads them back.
            'department_by' => $this->whenLoaded('departmentReviewer', fn () => $this->departmentReviewer?->name),
            'decided_by' => $this->whenLoaded('decider', fn () => $this->decider?->name),
            'employee' => $this->whenLoaded('employee', fn () => ['id' => $this->employee->id, 'empNo' => $this->employee->emp_no, 'name' => $this->employee->name]),
            'replacement' => $this->whenLoaded('replacement', fn () => $this->replacement ? ['id' => $this->replacement->id, 'name' => $this->replacement->name] : null),
        ];
    }
}
