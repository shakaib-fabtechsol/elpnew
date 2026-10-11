<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;

/** No AI key is configured: every feature falls back to its own rules. */
class NullAiClient implements AiClient
{
    public function available(): bool
    {
        return false;
    }

    public function engine(): string
    {
        return 'none';
    }

    public function json(string $instructions, string $prompt, array $schema, ?UploadedFile $file = null): array
    {
        throw new AiUnavailable('No AI service is switched on.');
    }
}
