<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * An amount in Omani rials: three decimals, stored as DECIMAL(12,3) and read
 * back as a number (not the string a decimal cast gives), so the JSON carries
 * 400.0 rather than "400.000" and the front end can add it up.
 */
class Money implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?float
    {
        return $value === null ? null : round((float) $value, 3);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return number_format((float) $value, 3, '.', '');
    }
}
