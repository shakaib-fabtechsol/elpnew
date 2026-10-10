<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** One line of a request's History. */
class RequestEventResource extends ApiResource
{
    protected array $except = ['subject_type', 'subject_id', 'user_id'];

    protected function extra(Request $request): array
    {
        return [
            'at' => $this->created_at?->toIso8601String(),
            'by' => $this->user?->name,
        ];
    }
}
