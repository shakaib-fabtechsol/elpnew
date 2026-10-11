<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * The search box, asked a question in plain words.
 *
 *   POST /ai/search   the question and the list's column names -> a query
 *
 * The model never sees the records. It is given the question, the names of
 * the list's columns and, for columns that hold a handful of fixed values
 * (a status, a department), those values - and it answers with a query in
 * the search box's own syntax, which the screen then runs over the rows it
 * already holds. With no AI connected the screen's own word search is used.
 */
class AiSearchController extends Controller
{
    public function __invoke(Request $request, AiClient $ai): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'max:300'],
            'fields' => ['present', 'array', 'max:60'],
            'fields.*.key' => ['required', 'string', 'max:60', 'regex:/^[A-Za-z_][A-Za-z0-9_]*$/'],
            'fields.*.kind' => ['nullable', 'string', 'max:20'],
            'fields.*.values' => ['nullable', 'array', 'max:12'],
            'fields.*.values.*' => ['string', 'max:60'],
        ]);

        if (! $ai->available()) {
            return response()->json(['data' => ['available' => false, 'engine' => 'rules']]);
        }

        $key = 'ai-search:'.sha1(json_encode([$ai->engine(), $data['question'], $data['fields'], now()->format('Y-m-d')]));

        try {
            $answer = Cache::remember($key, now()->addHours(12), fn () => $ai->json(
                $this->instructions(),
                json_encode(['question' => $data['question'], 'columns' => $data['fields']], JSON_UNESCAPED_UNICODE),
                Schema::object([
                    'query' => Schema::string(),
                    'explanation' => Schema::string(),
                ]),
            ));
        } catch (AiUnavailable) {
            return response()->json(['data' => ['available' => false, 'engine' => 'rules']]);
        }

        // Only columns the list really has may be named in the query.
        $known = array_map('strtolower', array_column($data['fields'], 'key'));
        $query = preg_replace_callback(
            '/(^|\s)(-?)([A-Za-z_][A-Za-z0-9_]*)(:|>=|<=|>|<)/',
            fn ($m) => in_array(strtolower($m[3]), $known, true) ? $m[0] : $m[1].$m[2],
            mb_substr(trim((string) ($answer['query'] ?? '')), 0, 300),
        );

        return response()->json(['data' => [
            'available' => true,
            'engine' => $ai->engine(),
            'query' => trim($query),
            'explanation' => mb_substr((string) ($answer['explanation'] ?? ''), 0, 200),
        ]]);
    }

    private function instructions(): string
    {
        $today = now()->format('Y-m-d (l)');

        return <<<TEXT
        You turn a question typed into the search box of a law firm's management system into a search query. The question may be in English or Arabic. Today is {$today}.
        You are given the question and the list's columns: each with its key, the kind of value it holds (text, number or date) and, for columns with a few fixed values, those values. You do not see the records.

        The query syntax (terms are separated by spaces and ALL must match):
        - word                 the word appears somewhere on the row (matched at the start of a word, any letter case)
        - "two words"          the phrase, as written
        - key:value            only in that column. Quote a value with spaces: key:"Legal Services"
        - -term or -key:value  rows that do NOT match
        - key>value, key>=value, key<value, key<=value   for number and date columns. Dates are YYYY-MM-DD.
        - expired              any date on the row has passed
        - expiring             any date on the row falls within the next 60 days
        - overdue              any date on the row has passed

        Rules:
        - Use only the column keys you were given, spelled exactly. When a fixed value is listed, use it exactly as listed.
        - Work out relative dates ("this month", "before March", "last year") against today and write them as comparisons on the right date column.
        - Amounts and counts ("more than 1000", "at least 3") become comparisons on the right number column.
        - Leave out filler words ("show me", "all", "please", "employees"). If the question is already a few key words, return them as they are.
        - When nothing in the question maps to a column, fall back to the important words themselves.
        - "explanation" is one short English sentence saying what the query looks for.
        TEXT;
    }
}
