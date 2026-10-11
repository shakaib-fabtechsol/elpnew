<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

/**
 * The reading behind a request list's "AI Overview": a suggested figure, how
 * likely a request is to be approved, and what stands out in the history.
 *
 *   POST /ai/overview   the list's own rows and policy figures -> the reading
 *
 * The limits themselves (what is left, what the policy allows) are worked out
 * by the system and sent in as facts: the model reads them, it does not set
 * them, and its suggestion is held to them here whatever it answers. A list
 * with no requests yet is read too, from the policy figures alone. With no
 * AI connected, or none answering, `available` is false and the screen keeps
 * the figures it works out itself.
 */
class AiOverviewController extends Controller
{
    public function __invoke(Request $request, AiClient $ai): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'max:60'],
            'measure' => ['required', Rule::in(['money', 'days', 'hours', 'count'])],
            'history' => ['present', 'array', 'max:40'],
            'history.*.date' => ['nullable', 'string', 'max:20'],
            'history.*.amount' => ['nullable', 'numeric'],
            'history.*.status' => ['required', 'string', 'max:40'],
            'history.*.type' => ['nullable', 'string', 'max:80'],
            'facts' => ['nullable', 'array', 'max:12'],
            'facts.*' => ['nullable', 'numeric'],
        ]);

        // Nobody to read it: the screen's own figures stand. An empty history
        // is still read - a first request has policy figures to go on, and
        // the card should say so rather than show a figure nobody worked out.
        if (! $ai->available()) {
            return response()->json(['data' => ['available' => false, 'engine' => 'rules']]);
        }

        $facts = array_filter($data['facts'] ?? [], fn ($value) => $value !== null);
        // The same history on the same day reads the same way, and is paid for once.
        $key = 'ai-overview:'.sha1(json_encode([$ai->engine(), $data['kind'], $data['measure'], $data['history'], $facts, now()->format('Y-m-d')]));

        try {
            $reading = Cache::remember($key, now()->addHours(12), fn () => $this->read($ai, $data['kind'], $data['measure'], $data['history'], $facts));
        } catch (AiUnavailable) {
            return response()->json(['data' => ['available' => false, 'engine' => 'rules']]);
        }

        return response()->json(['data' => ['available' => true, 'engine' => $ai->engine(), ...$reading]]);
    }

    private function read(AiClient $ai, string $kind, string $measure, array $history, array $facts): array
    {
        $answer = $ai->json(
            $this->instructions($measure),
            json_encode(['requestKind' => $kind, 'measuredIn' => $measure, 'policyFigures' => $facts, 'history' => $history], JSON_UNESCAPED_UNICODE),
            Schema::object([
                'recommended' => Schema::number(nullable: true),
                'recommendedReason' => Schema::string(),
                'probability' => Schema::number(),
                'probabilityReason' => Schema::string(),
                'insights' => Schema::list(Schema::string()),
            ]),
        );

        $recommended = is_numeric($answer['recommended'] ?? null) ? max(0, (float) $answer['recommended']) : null;
        // Never more than the policy leaves, whatever the model answered.
        if ($recommended !== null && isset($facts['remaining'])) {
            $recommended = min($recommended, max(0, (float) $facts['remaining']));
        }

        return [
            'recommended' => $measure === 'money' ? $recommended : null,
            'recommendedReason' => mb_substr((string) ($answer['recommendedReason'] ?? ''), 0, 200),
            'probability' => max(0, min(100, (int) round((float) ($answer['probability'] ?? 0)))),
            'probabilityReason' => mb_substr((string) ($answer['probabilityReason'] ?? ''), 0, 200),
            'insights' => array_slice(array_values(array_filter(array_map(
                fn ($line) => mb_substr(trim((string) $line), 0, 180),
                (array) ($answer['insights'] ?? []),
            ))), 0, 3),
        ];
    }

    private function instructions(string $measure): string
    {
        $today = now()->format('Y-m-d');

        return <<<TEXT
        You advise an employee of a law firm in Oman who is looking at the list of their own past requests of one kind, before making another. Today is {$today}. Money is in Omani rials (OMR).
        You are given the kind of request, what it is measured in ({$measure}), the policy figures the system has worked out (for example "remaining": what the policy still allows; "limit"; "netSalary"; "outstanding": what is still owed), and the history: each past request with its date, amount, status and type.

        Use only what you are given. Do not invent policy, figures or events.
        - "recommended": for requests measured in money, the amount you would suggest for the next request - in line with what was approved before, never above "remaining" when it is given, rounded down to the nearest 50 (or to the nearest 10 below 100). Null when measured in anything else, when nothing is left, or when there is no basis to suggest one.
        - "recommendedReason": one short sentence saying why that amount (or why none).
        - "probability": your estimate from 0 to 100 that a request like the recommended one would be approved, judged from how past requests were decided, what is still pending or owed, and the policy figures. It is an estimate, not a promise: with few decided requests stay near the middle.
        - "probabilityReason": one short sentence naming what the estimate rests on.
        - When the history is empty this is the employee's first request of this kind. Say so plainly. Suggest an amount only if the policy figures give a basis for one (a modest part of "remaining", never all of it); otherwise null. Put the probability near the middle (45 to 60) and say it rests on policy alone because nothing has been decided yet. The insights then say what the policy figures allow and that there is no history yet - never describe past requests that do not exist.
        - Write for the employee, not about your inputs: never mention "policy figures", what was or was not "provided", or missing data. Where there is no figure to go on, simply leave it out - for example "This will be your first leave request." and "Its outcome will depend on management's review."
        - "insights": up to three short, concrete observations the employee would find useful (a pattern in what they ask for, repeated rejections, something still pending, how close they are to a limit). Plain English, one sentence each, addressed as "you". No advice beyond the data.
        TEXT;
    }
}
