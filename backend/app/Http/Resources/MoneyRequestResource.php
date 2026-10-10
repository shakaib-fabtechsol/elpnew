<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * Any request on the SADEED workflow: its own fields, plus who it is for,
 * how its status reads on that module's screen, what was granted, and who
 * decided and paid it.
 */
class MoneyRequestResource extends ApiResource
{
    protected array $except = ['decided_by', 'paid_by'];

    protected function extra(Request $request): array
    {
        return [
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'empNo' => $this->employee->emp_no,
                'name' => $this->employee->name,
                'bankName' => $this->employee->bank_name,
                'accountNumber' => $this->employee->account_number,
            ]),
            'status_label' => $this->statusLabel(),
            'decision_label' => $this->decision?->label(),
            'granted_amount' => $this->status->isGranted() ? $this->grantedAmount() : null,
            'decided_by' => $this->whenLoaded('decider', fn () => $this->decider?->name),
            'paid_by' => $this->whenLoaded('payer', fn () => $this->payer?->name),
            'history' => RequestEventResource::collection($this->whenLoaded('events')),
            ...$this->moduleFields($request),
        ];
    }

    /** What one module adds on top (a loan's schedule, say). */
    protected function moduleFields(Request $request): array
    {
        return [];
    }
}
