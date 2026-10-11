<?php

namespace App\Services\Ai;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** OpenAI (Chat Completions, structured output). The key never leaves the server. */
class OpenAiClient implements AiClient
{
    public function __construct(private string $apiKey, private string $model) {}

    public function available(): bool
    {
        return true;
    }

    public function engine(): string
    {
        return 'openai';
    }

    public function json(string $instructions, string $prompt, array $schema, ?UploadedFile $file = null): array
    {
        $content = [['type' => 'text', 'text' => $prompt]];

        if ($file && in_array($file->getMimeType(), self::READABLE, true)) {
            $data = 'data:'.$file->getMimeType().';base64,'.base64_encode($file->getContent());
            // A PDF goes as a file, a photo as an image.
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
                    ['role' => 'system', 'content' => $instructions],
                    ['role' => 'user', 'content' => $content],
                ],
                'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => ['name' => 'answer', 'strict' => true, 'schema' => $schema],
                ],
            ]);

        if ($response->failed()) {
            Log::warning('OpenAI call failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
            throw new AiUnavailable('The AI service did not answer (HTTP '.$response->status().').', $response->status());
        }

        $answer = json_decode((string) $response->json('choices.0.message.content'), true);
        if (! is_array($answer)) {
            Log::warning('OpenAI returned no usable answer', [
                'finish' => $response->json('choices.0.finish_reason'),
                'refusal' => $response->json('choices.0.message.refusal'),
            ]);
            throw new AiUnavailable('The AI service returned nothing that could be read.');
        }

        return $answer;
    }
}
