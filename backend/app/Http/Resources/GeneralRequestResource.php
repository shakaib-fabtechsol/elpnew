<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class GeneralRequestResource extends ApiResource
{
    protected array $except = ['reviewed_by'];

    protected function extra(Request $request): array
    {
        return [
            'employee' => $this->whenLoaded('employee', fn () => ['id' => $this->employee->id, 'empNo' => $this->employee->emp_no, 'name' => $this->employee->name]),
            'reviewed_by' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
        ];
    }
}
