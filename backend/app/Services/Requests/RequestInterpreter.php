<?php

namespace App\Services\Requests;

use Illuminate\Http\UploadedFile;

/**
 * Reads what an employee wrote (or the document they attached) and proposes
 * which request it is and what its fields hold.
 *
 * A proposal is only that: RequestCatalog decides what is allowed and what is
 * still missing, the employee reviews it, and the module's own endpoint
 * creates the request.
 */
interface RequestInterpreter
{
    /**
     * @return array{
     *   type: ?string, confidence: float, summary: string, fields: array<string, mixed>,
     *   invoice: ?array<string, mixed>, engine: string
     * }
     *
     * @throws InterpreterUnavailable when the reading could not be done at all
     */
    public function interpret(?string $text, ?UploadedFile $file): array;
}
