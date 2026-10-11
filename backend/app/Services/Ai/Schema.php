<?php

namespace App\Services\Ai;

/**
 * Short ways to write the strict JSON Schema an AiClient takes, so a
 * feature's schema reads as a list of its fields.
 */
final class Schema
{
    /** An object: every property required, nothing else allowed. */
    public static function object(array $properties, bool $nullable = false): array
    {
        return [
            'type' => $nullable ? ['object', 'null'] : 'object',
            'properties' => $properties,
            'required' => array_keys($properties),
            'additionalProperties' => false,
        ];
    }

    public static function string(bool $nullable = false, ?array $enum = null): array
    {
        return [
            'type' => $nullable ? ['string', 'null'] : 'string',
            ...($enum ? ['enum' => $nullable ? [...$enum, null] : $enum] : []),
        ];
    }

    public static function number(bool $nullable = false): array
    {
        return ['type' => $nullable ? ['number', 'null'] : 'number'];
    }

    public static function boolean(): array
    {
        return ['type' => 'boolean'];
    }

    public static function list(array $items): array
    {
        return ['type' => 'array', 'items' => $items];
    }
}
