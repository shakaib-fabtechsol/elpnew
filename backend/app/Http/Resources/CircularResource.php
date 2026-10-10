<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class CircularResource extends ApiResource
{
    protected array $except = ['file_path', 'issued_by'];

    protected function extra(Request $request): array
    {
        $employeeId = $request->user()?->employee_id;

        return [
            'supersedes' => $this->supersedes_id,
            'issued_by' => $this->whenLoaded('issuer', fn () => $this->issuer?->name),
            'superseded_by' => $this->whenLoaded('supersededBy', fn () => $this->supersededBy?->id),
            'acknowledgements' => $this->whenLoaded('acknowledgements', fn () => $this->acknowledgements->map(fn ($a) => [
                'employeeId' => $a->employee_id,
                'name' => $a->relationLoaded('employee') ? $a->employee?->name : null,
                'at' => $a->acknowledged_at->toIso8601String(),
            ])->values()),
            'acknowledged_by_me' => $this->whenLoaded('acknowledgements', fn () => $this->acknowledgements->contains('employee_id', $employeeId)),
        ];
    }
}
