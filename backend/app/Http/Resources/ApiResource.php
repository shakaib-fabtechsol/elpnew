<?php

namespace App\Http\Resources;

use App\Support\Keys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Every record the API returns: its columns in camelCase, plus whatever the
 * resource works out on top (`extra`). Figures that can be worked out - a
 * net salary, a loan's balance - are worked out here on every read rather
 * than stored beside the numbers they come from.
 */
abstract class ApiResource extends JsonResource
{
    /** Columns never sent out. */
    protected array $except = [];

    public function toArray(Request $request): array
    {
        $attributes = array_diff_key($this->resource->attributesToArray(), array_flip($this->except));

        return Keys::camel(array_merge($attributes, $this->extra($request)));
    }

    /** Worked-out fields and loaded relations, keyed in snake_case or camelCase. */
    protected function extra(Request $request): array
    {
        return [];
    }
}
