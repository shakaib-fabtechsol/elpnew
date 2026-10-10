<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * The database speaks snake_case and the React app camelCase. The API speaks
 * the app's language, so keys are turned over once at the edge - here - and
 * nowhere else.
 */
final class Keys
{
    /** request_no -> requestNo, recursively through nested lists and objects. */
    public static function camel(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            $name = is_string($key) ? Str::camel($key) : $key;
            $out[$name] = is_array($value) ? self::camel($value) : $value;
        }

        return $out;
    }

    /**
     * requestNo -> request_no, top level only: nested values (an invoice and
     * its lines, say) are stored as JSON exactly as the app sent them.
     */
    public static function snake(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            $out[is_string($key) ? Str::snake($key) : $key] = $value;
        }

        return $out;
    }
}
