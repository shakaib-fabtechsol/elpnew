<?php

namespace App\Services\Requests;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The reading done by OpenAI (Chat Completions, structured output).
 *
 * The employee's words and the attached document are sent to OpenAI's API,
 * with a strict schema the answer must follow; the key lives in
 * OPENAI_API_KEY on the server and never reaches the browser. Nothing is
 * created here - the answer is a proposal the employee reviews.
 */
class OpenAiRequestInterpreter extends AiRequestInterpreter
{
    public function __construct(private string $apiKey, private string $model) {}

    protected function engine(): string
    {
        return 'openai';
    }

    protected function ask(string $prompt, ?UploadedFile $file, array $facts): array
    {
        $content = [['type' => 'text', 'text' => $prompt]];

        if ($file && in_array($file->getMimeType(), static::READABLE, true)) {
            $data = 'data:'.$file->getMimeType().';base64,'.base64_encode($file->getContent());
            // A PDF goes as a file, a photo as an image: the two are read
            // through different parts of the same message.
            $content[] = $file->getMimeType() === 'application/pdf'
                ? ['type' => 'file', 'file' => ['filename' => $file->getClientOriginalName() ?: 'document.pdf', 'file_data' => $data]]
                : ['type' => 'image_url', 'image_url' => ['url' => $data]];
        }

        // No temperature: the current models accept only their default.
        $response = Http::withToken($this->apiKey)
            ->timeout(45)
            ->retry(2, 600, throw: false)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => [
                    ['role' => 'system', 'content' => $this->instructions($facts)],
                    ['role' => 'user', 'content' => $content],
                ],
                'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => ['name' => 'request', 'strict' => true, 'schema' => $this->schema()],
                ],
            ]);

        if ($response->failed()) {
            // The reason is for the log, not for the employee.
            Log::warning('OpenAI request interpretation failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
            // The status travels with it: 429 is the usage limit, which the
            // employee is told apart from the service being down.
            throw new InterpreterUnavailable('The AI service did not answer (HTTP '.$response->status().').', $response->status());
        }

        $answer = json_decode((string) $response->json('choices.0.message.content'), true);
        if (! is_array($answer)) {
            Log::warning('OpenAI returned no usable answer', [
                'finish' => $response->json('choices.0.finish_reason'),
                'refusal' => $response->json('choices.0.message.refusal'),
            ]);
            throw new InterpreterUnavailable('The AI service returned nothing that could be read.');
        }

        return $answer;
    }

    /**
     * The shape the answer must take (JSON Schema, strict mode): every
     * property is listed as required and says for itself that it may be null,
     * and no object takes a property the schema does not name.
     */
    private function schema(): array
    {
        $property = fn (array $field) => $field[0] === 'number'
            ? ['type' => ['number', 'null']]
            : ['type' => ['string', 'null'], ...(isset($field[1]) ? ['enum' => [...$field[1], null]] : [])];

        $object = fn (array $properties, bool $nullable = false) => [
            'type' => $nullable ? ['object', 'null'] : 'object',
            'properties' => $properties,
            'required' => array_keys($properties),
            'additionalProperties' => false,
        ];

        return $object([
            'type' => ['type' => 'string', 'enum' => $this->typeOptions()],
            'confidence' => ['type' => 'number'],
            'summary' => ['type' => 'string'],
            ...array_map($property, $this->answerFields()),
            'invoice' => $object([
                ...array_map($property, $this->invoiceFields()),
                'items' => ['type' => 'array', 'items' => $object([
                    'name' => ['type' => 'string'],
                    'quantity' => ['type' => 'number'],
                    'amount' => ['type' => 'number'],
                ])],
            ], nullable: true),
        ]);
    }
}
