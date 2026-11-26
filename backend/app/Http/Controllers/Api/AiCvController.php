<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * An employee's CV as one professional paragraph, for Personal Information's
 * "Generate with AI".
 *
 *   POST /ai/cv   what is known of the person -> { summary, available, engine }
 *
 * The facts are what the form holds and what was read off the uploaded
 * papers (the CV, the degree); the model only words them, and is told to add
 * nothing that is not among them. With no AI connected, or none answering,
 * the paragraph is put together from the same facts by rule, so the button
 * always gives the person something to edit.
 */
class AiCvController extends Controller
{
    public function __invoke(Request $request, AiClient $ai): JsonResponse
    {
        $facts = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'occupation' => ['nullable', 'string', 'max:80'],
            'practiceLevel' => ['nullable', 'string', 'max:80'],
            'department' => ['nullable', 'string', 'max:80'],
            'highestEducation' => ['nullable', 'string', 'max:60'],
            'qualification' => ['nullable', 'string', 'max:200'],
            'institution' => ['nullable', 'string', 'max:200'],
            'graduationYear' => ['nullable', 'string', 'max:10'],
            'yearsOfExperience' => ['nullable', 'numeric', 'between:0,60'],
            'specialisations' => ['nullable', 'array', 'max:8'],
            'specialisations.*' => ['string', 'max:80'],
            'languages' => ['nullable', 'array', 'max:12'],
            'languages.*' => ['string', 'max:30'],
            'experience' => ['nullable', 'string', 'max:4000'],
        ]);

        if ($ai->available()) {
            try {
                $answer = $ai->json(
                    'Write a short professional CV summary (two or three sentences, third person, no headings, no bullet points) '
                    .'for a law firm employee record, using ONLY the facts given. Do not invent employers, years, degrees or skills. '
                    .'Leave out anything not given. Plain English.',
                    json_encode(array_filter($facts), JSON_UNESCAPED_UNICODE),
                    Schema::object(['summary' => Schema::string()]),
                );
                $summary = trim((string) ($answer['summary'] ?? ''));
                if ($summary !== '') {
                    return response()->json(['data' => ['available' => true, 'engine' => $ai->engine(), 'summary' => $summary]]);
                }
            } catch (AiUnavailable) {
                // Worded by rule below.
            }
        }

        return response()->json(['data' => ['available' => false, 'engine' => 'rules', 'summary' => $this->byRule($facts)]]);
    }

    /** The same facts, put into sentences without a model. */
    private function byRule(array $facts): string
    {
        $role = trim(($facts['practiceLevel'] ?? '') ?: ($facts['occupation'] ?? '')) ?: 'professional';
        $years = isset($facts['yearsOfExperience']) ? (int) $facts['yearsOfExperience'] : null;
        $article = preg_match('/^[aeiou]/i', $role) ? 'An' : 'A';

        $first = $article.' '.$role;
        $first .= $years ? ' with over '.$years.' year'.($years === 1 ? '' : 's').' of experience' : '';
        if (! empty($facts['specialisations'])) {
            $first .= ', specialising in '.$this->listOf($facts['specialisations']);
        } elseif (! empty($facts['department'])) {
            $first .= ' in '.$facts['department'];
        }
        // Nothing known of the work itself: no sentence of filler about it.
        $knownWork = ($facts['practiceLevel'] ?? '') || ($facts['occupation'] ?? '') || $years || ! empty($facts['specialisations']) || ! empty($facts['department']);
        $sentences = $knownWork ? [$first.'.'] : [];

        $degree = ($facts['qualification'] ?? '') ?: ($facts['highestEducation'] ?? '');
        if ($degree) {
            $held = 'Holds a '.$degree;
            if (! empty($facts['institution'])) {
                $held .= ' from '.$facts['institution'];
            }
            if (! empty($facts['graduationYear'])) {
                $held .= ' ('.$facts['graduationYear'].')';
            }
            $sentences[] = $held.'.';
        }
        if (! empty($facts['languages'])) {
            $sentences[] = 'Speaks '.$this->listOf($facts['languages']).'.';
        }

        return implode(' ', $sentences);
    }

    private function listOf(array $items): string
    {
        $items = array_values(array_filter(array_map('trim', $items)));
        if (count($items) < 2) {
            return $items[0] ?? '';
        }

        return implode(', ', array_slice($items, 0, -1)).' and '.end($items);
    }
}
