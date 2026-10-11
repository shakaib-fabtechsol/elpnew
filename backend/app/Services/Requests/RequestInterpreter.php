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
     * @param  list<string>  $facts  what SADEED already knows about the employee
     * @return array{
     *   type: ?string, confidence: float, summary: string, fields: array<string, mixed>,
     *   invoice: ?array<string, mixed>, engine: string
     * }
     *
     * @throws InterpreterUnavailable when the reading could not be done at all
     */
    public function interpret(?string $text, ?UploadedFile $file, array $facts = []): array;

    /**
     * The same reading for a request already drafted: the employee answers a
     * question about something missing, or says what to change, and the
     * draft is brought up to date. Returns the same shape; "fields" holds
     * what the message settles, the rest of the draft is kept by the caller.
     *
     * @param  array<string, mixed>  $values  the draft's fields as they stand
     * @param  list<string>  $facts  what SADEED already knows about the employee
     *
     * @throws InterpreterUnavailable
     */
    public function revise(string $type, array $values, ?array $invoice, ?string $message, ?UploadedFile $file, array $facts = []): array;
}
