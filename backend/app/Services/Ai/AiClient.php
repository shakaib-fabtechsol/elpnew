<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;

/**
 * One question to an AI model, answered as JSON in a shape we name.
 *
 * Everything that reads with AI outside the request box - an invoice, an
 * employee's request history, a search question - goes through this, so
 * which company's model answers is decided in one place (AppServiceProvider)
 * and the features do not care.
 *
 * `$schema` is JSON Schema in the strict form: every property listed in
 * `required`, `additionalProperties` false, and a value that may be missing
 * typed as [<type>, 'null'].
 */
interface AiClient
{
    /** Documents a model can be sent (and the upload rules allow). */
    public const READABLE = ['application/pdf', 'image/jpeg', 'image/png'];

    /** Whether a model is connected at all; false means callers use their rules. */
    public function available(): bool;

    /** Who answers: "openai", "gemini", or "none". */
    public function engine(): string;

    /**
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     *
     * @throws AiUnavailable
     */
    public function json(string $instructions, string $prompt, array $schema, ?UploadedFile $file = null): array;
}
