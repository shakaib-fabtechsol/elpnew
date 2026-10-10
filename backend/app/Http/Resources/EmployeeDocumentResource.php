<?php

namespace App\Http\Resources;

use App\Models\EmployeeDocument;
use Illuminate\Http\Request;

class EmployeeDocumentResource extends ApiResource
{
    protected function extra(Request $request): array
    {
        $siblings = $this->relationLoaded('siblings') ? $this->getRelation('siblings') : collect([$this->resource]);

        return [
            'category' => match (true) {
                in_array($this->type, EmployeeDocument::IDENTITY_TYPES, true) || $this->type === 'Other Identity Document' => 'Identity & Residency',
                in_array($this->type, [EmployeeDocument::LAWYER_TYPE, EmployeeDocument::MEMBERSHIP_TYPE, 'Other Professional Licence'], true) => 'Professional Licenses',
                str_ends_with($this->type, 'Decision') => 'Administrative Decisions',
                default => 'Qualifications & Experience',
            },
            'status' => $this->statusAmong($siblings),
            'uploaded_at' => $this->uploaded_at->format('Y-m-d\TH:i'),
            'download_url' => url('/api/v1/employees/'.$this->employee_id.'/documents/'.$this->id.'/download'),
        ];
    }
}
