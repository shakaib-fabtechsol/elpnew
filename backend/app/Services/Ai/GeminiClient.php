<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Google Gemini (generateContent, JSON mode). The key never leaves the server. */
class GeminiClient implements AiClient
{
    public function __construct(private string $apiKey, private string $model) {}

    public function available(): bool
    {
        return true;
    }

    public function engine(): string
    {
        return 'gemini';
    }

    public function json(string $instructions, string $prompt, array $schema, ?UploadedFile $file = null): array
    {
        $parts = [['text' => $prompt]];

        if ($file && in_array($file->getMimeType(), self::READABLE, true)) {
            $parts[] = ['inlineData' => ['mimeType' => $file->getMimeType(), 'data' => base64_encode($file->getContent())]];
        }

        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->timeout(45)
            ->retry(2, 600, throw: false)
            ->post('https://generativelanguage.googleapis.com/v1beta/models/'.$this->model.':generateContent', [
                'systemInstruction' => ['parts' => [['text' => $instructions]]],
                'contents' => [['role' => 'user', 'parts' => $parts]],
                'generationConfig' => [
                    'temperature' => 0,
                    'responseMimeType' => 'application/json',
                    'responseSchema' => self::dialect($schema),
                ],
            ]);

        if ($response->failed()) {
            Log::warning('Gemini call failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
            throw new AiUnavailable('The AI service did not answer (HTTP '.$response->status().').', $response->status());
        }

        $answer = json_decode((string) $response->json('candidates.0.content.parts.0.text'), true);
        if (! is_array($answer)) {
            Log::warning('Gemini returned no usable answer', ['finish' => $response->json('candidates.0.finishReason')]);
            throw new AiUnavailable('The AI service returned nothing that could be read.');
        }

        return $answer;
    }

    /**
     * Strict JSON Schema, as the features write it, in Gemini's own dialect:
     * upper-case type names, `nullable` instead of a null in the type, and no
     * `additionalProperties`.
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    public static function dialect(array $schema): array
    {
        $types = (array) ($schema['type'] ?? 'string');
        $out = ['type' => strtoupper((string) (array_values(array_diff($types, ['null']))[0] ?? 'string'))];

        if (in_array('null', $types, true)) {
            $out['nullable'] = true;
        }
        if (isset($schema['enum'])) {
            $out['enum'] = array_values(array_filter($schema['enum'], fn ($value) => $value !== null));
        }
        if (isset($schema['properties'])) {
            $out['properties'] = array_map(fn ($property) => self::dialect($property), $schema['properties']);
            // Only what cannot be null is required; the rest may be left out.
            $out['required'] = array_values(array_filter(
                array_keys($schema['properties']),
                fn ($key) => ! in_array('null', (array) ($schema['properties'][$key]['type'] ?? []), true),
            ));
        }
        if (isset($schema['items'])) {
            $out['items'] = self::dialect($schema['items']);
        }

        return $out;
    }
}
