<?php

namespace App\Services\Requests;

use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\GeneralRequest;
use App\Models\SalaryAdvance;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The reading done by Google Gemini (generateContent, JSON mode).
 *
 * The employee's words and the attached document are sent to Google's API,
 * with a schema the answer must follow; the key lives in GEMINI_API_KEY on
 * the server and never reaches the browser. Nothing is created here - the
 * answer is a proposal the employee reviews.
 */
class GeminiRequestInterpreter implements RequestInterpreter
{
    /** Documents Gemini reads inline (and the upload rule allows). */
    private const READABLE = ['application/pdf', 'image/jpeg', 'image/png'];

    public function __construct(private string $apiKey, private string $model) {}

    public function interpret(?string $text, ?UploadedFile $file, array $facts = []): array
    {
        return $this->ask("Employee's request:\n".(filled($text) ? $text : '(no text - see the attached document)'), $file, $facts);
    }

    public function revise(string $type, array $values, ?array $invoice, ?string $message, ?UploadedFile $file, array $facts = []): array
    {
        $draft = json_encode(['type' => $type, ...array_filter($values, fn ($value) => $value !== null), 'invoice' => $invoice], JSON_UNESCAPED_UNICODE);
        $said = filled($message) ? $message : '(no text - see the attached document)';

        return $this->ask(
            "The request drafted so far, as JSON:\n{$draft}\n\n"
            ."The employee now answers a question about it, or asks for a change:\n{$said}\n\n"
            .'Return the complete updated request. Keep every value the employee did not change, apply exactly what they said, '
            .'and keep the type unless they clearly ask for a different kind of request. "summary" describes the request as it now stands.',
            $file,
            $facts,
        );
    }

    private function ask(string $prompt, ?UploadedFile $file, array $facts): array
    {
        $parts = [['text' => $prompt]];

        if ($file && in_array($file->getMimeType(), self::READABLE, true)) {
            $parts[] = ['inlineData' => ['mimeType' => $file->getMimeType(), 'data' => base64_encode($file->getContent())]];
        }

        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->timeout(45)
            ->retry(2, 600, throw: false)
            ->post('https://generativelanguage.googleapis.com/v1beta/models/'.$this->model.':generateContent', [
                'systemInstruction' => ['parts' => [['text' => $this->instructions($facts)]]],
                'contents' => [['role' => 'user', 'parts' => $parts]],
                'generationConfig' => [
                    'temperature' => 0,
                    'responseMimeType' => 'application/json',
                    'responseSchema' => $this->schema(),
                ],
            ]);

        if ($response->failed()) {
            // The reason is for the log, not for the employee.
            Log::warning('Gemini request interpretation failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
            // The status travels with it: 429 is the usage limit, which the
            // employee is told apart from the service being down.
            throw new InterpreterUnavailable('The AI service did not answer (HTTP '.$response->status().').', $response->status());
        }

        $answer = json_decode((string) $response->json('candidates.0.content.parts.0.text'), true);
        if (! is_array($answer)) {
            Log::warning('Gemini returned no usable answer', ['finish' => $response->json('candidates.0.finishReason')]);
            throw new InterpreterUnavailable('The AI service returned nothing that could be read.');
        }

        $type = $answer['type'] ?? null;

        return [
            'type' => is_string($type) && isset(RequestCatalog::TYPES[$type]) ? $type : null,
            'confidence' => max(0.0, min(1.0, (float) ($answer['confidence'] ?? 0))),
            'summary' => mb_substr((string) ($answer['summary'] ?? ''), 0, 300),
            'fields' => array_diff_key($answer, array_flip(['type', 'confidence', 'summary', 'invoice'])),
            'invoice' => $answer['invoice'] ?? null,
            'engine' => 'gemini',
        ];
    }

    private function instructions(array $facts = []): string
    {
        $known = $facts
            ? "What the system already holds about this employee - never ask for it, and use it to resolve phrases like \"my full salary\" or \"all my remaining leave\":\n- ".implode("\n- ", $facts)
            : '';

        $types = '';
        foreach (RequestCatalog::TYPES as $key => [$label, , $what]) {
            $types .= "- {$key} ({$label}): {$what}\n";
        }

        $today = now()->format('Y-m-d (l)');

        return <<<TEXT
        You read requests written by employees of a law firm in Oman and turn each into a structured request.
        The text may be in English, Arabic or Urdu (including Roman Urdu). Today is {$today}. Amounts are in Omani rials (OMR).

        Choose exactly one type, or "unknown" if the text is not a request the firm handles or is too vague to tell:
        {$types}
        Rules:
        - Extract only what the employee actually stated or the document actually shows. Never invent an amount, a date or a reason; leave a field null when it is not given.
        - An attached pharmacy / clinic / hospital invoice means "medical"; a flight ticket "airTicket"; a hotel or meals bill "travel"; fuel or taxi receipts "transport". For these four, read the document into "invoice" exactly as printed (number, date as YYYY-MM-DD, supplier, VAT number, each line with quantity and unit amount, subtotal, VAT, total). If no such document is attached, leave "invoice" null.
        - Fields with a fixed list of options (purpose, leaveType, assistanceType, beneficiary, bonusSubcategory, requestType) take the option that best fits what the employee said - "dental work" is "Medical Expenses", "an emergency" is "Emergency Case", "school fees" is "Education Expenses". Leave such a field null only when nothing they said points to any option.
        - Dates are YYYY-MM-DD. Resolve relative dates ("next Sunday", "from the 5th") against today. For leave give fromDate and toDate (inclusive).
        - deductMonth is an English month name; deductYear a four-digit year. If the employee says "next month's salary", work it out from today.
        - startMonth (loan) is "Month YYYY", e.g. "November 2026". period (overtime) is YYYY-MM.
        - "reason" is the employee's own explanation, rewritten as one or two clear English sentences. Do not add facts.
        - "summary" is one English sentence saying what you understood, for the employee to confirm.
        - "confidence" is how sure you are of the type, from 0 to 1.

        {$known}
        TEXT;
    }

    /** The shape the answer must take (Gemini's OpenAPI-style schema). */
    private function schema(): array
    {
        $string = fn (?array $enum = null) => ['type' => 'STRING', 'nullable' => true, ...($enum ? ['enum' => $enum] : [])];
        $number = ['type' => 'NUMBER', 'nullable' => true];

        return [
            'type' => 'OBJECT',
            'required' => ['type', 'confidence', 'summary'],
            'properties' => [
                'type' => ['type' => 'STRING', 'enum' => [...array_keys(RequestCatalog::TYPES), 'unknown']],
                'confidence' => ['type' => 'NUMBER'],
                'summary' => ['type' => 'STRING'],
                'amount' => $number,
                'monthly' => $number,
                'startMonth' => $string(),
                'deductMonth' => $string(SalaryAdvance::MONTHS),
                'deductYear' => $string(),
                'purpose' => $string(SalaryAdvance::PURPOSES),
                'assistanceType' => $string(array_keys(AssistanceRequest::TYPES)),
                'beneficiary' => $string(AssistanceRequest::BENEFICIARIES),
                'bonusSubcategory' => $string(Bonus::SUBCATEGORIES),
                'hours' => $number,
                'period' => $string(),
                'days' => $number,
                'year' => $string(),
                'leaveType' => $string(RequestCatalog::leaveTypes()),
                'fromDate' => $string(),
                'toDate' => $string(),
                'requestType' => $string(array_values(array_unique(array_merge(...array_map(fn ($kind) => $kind[2], array_values(GeneralRequest::KINDS)))))),
                'insuranceCovered' => $number,
                'reason' => $string(),
                'invoice' => [
                    'type' => 'OBJECT',
                    'nullable' => true,
                    'properties' => [
                        'invoiceNo' => $string(),
                        'invoiceDate' => $string(),
                        'supplierName' => $string(),
                        'supplierVat' => $string(),
                        'purpose' => $string(),
                        'items' => ['type' => 'ARRAY', 'items' => [
                            'type' => 'OBJECT',
                            'properties' => ['name' => ['type' => 'STRING'], 'quantity' => ['type' => 'NUMBER'], 'amount' => ['type' => 'NUMBER']],
                        ]],
                        'subtotal' => $number,
                        'vat' => $number,
                        'total' => $number,
                    ],
                ],
            ],
        ];
    }
}
