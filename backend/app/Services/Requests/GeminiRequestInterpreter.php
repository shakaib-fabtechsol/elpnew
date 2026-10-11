<?php

namespace App\Services\Requests;

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
class GeminiRequestInterpreter extends AiRequestInterpreter
{
    public function __construct(private string $apiKey, private string $model) {}

    protected function engine(): string
    {
        return 'gemini';
    }

    protected function ask(string $prompt, ?UploadedFile $file, array $facts): array
    {
        $parts = [['text' => $prompt]];

        if ($file && in_array($file->getMimeType(), static::READABLE, true)) {
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

        return $answer;
    }

    /** The shape the answer must take (Gemini's OpenAPI-style schema). */
    private function schema(): array
    {
        $property = fn (array $field) => $field[0] === 'number'
            ? ['type' => 'NUMBER', 'nullable' => true]
            : ['type' => 'STRING', 'nullable' => true, ...(isset($field[1]) ? ['enum' => $field[1]] : [])];

        return [
            'type' => 'OBJECT',
            'required' => ['type', 'confidence', 'summary'],
            'properties' => [
                'type' => ['type' => 'STRING', 'enum' => $this->typeOptions()],
                'confidence' => ['type' => 'NUMBER'],
                'summary' => ['type' => 'STRING'],
                ...array_map($property, $this->answerFields()),
                'invoice' => [
                    'type' => 'OBJECT',
                    'nullable' => true,
                    'properties' => [
                        ...array_map($property, $this->invoiceFields()),
                        'items' => ['type' => 'ARRAY', 'items' => [
                            'type' => 'OBJECT',
                            'properties' => ['name' => ['type' => 'STRING'], 'quantity' => ['type' => 'NUMBER'], 'amount' => ['type' => 'NUMBER']],
                        ]],
                    ],
                ],
            ],
        ];
    }
}
