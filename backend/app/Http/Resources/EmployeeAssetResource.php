<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class EmployeeAssetResource extends ApiResource
{
    protected function extra(Request $request): array
    {
        return [
            'recorded_by_name' => $this->relationLoaded('recorder') ? $this->recorder?->name : null,
        ];
    }
}
