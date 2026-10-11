<?php

namespace App\Services\Management;

use App\Models\DevelopmentAction;
use App\Models\Employee;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;

/**
 * The management insight for one employee: an executive summary, what went
 * well, what is of concern, what recurs, and what to do about it.
 *
 * The AI is given the signals and figures EmployeeSignals worked out from
 * the records, and writes from those alone - it is told not to add a fact,
 * and it never sees anything the manager could not open themselves. With no
 * key, or when the service does not answer, the same signals are laid out by
 * plain rules and the insight says so.
 */
final class InsightWriter
{
    public function __construct(private AiClient $ai) {}

    /**
     * @param  array{standing:string,facts:array<string,mixed>,signals:list<array<string,string>>}  $signals
     * @param  array<string,mixed>  $context  evaluations, violations, development actions, activity counts
     * @return array{engine:string,summary:string,achievements:list<string>,concerns:list<string>,patterns:list<string>,recommendations:list<array{title:string,kind:string,reason:string}>,notes:list<string>}
     */
    public function write(Employee $employee, array $signals, array $context): array
    {
        $notes = [];

        if ($this->ai->available()) {
            try {
                return [...$this->checked($this->ask($employee, $signals, $context)), 'engine' => $this->ai->engine(), 'notes' => []];
            } catch (AiUnavailable $down) {
                $notes[] = $down->getCode() === 429
                    ? 'The AI usage limit has been reached for now, so this was compiled from the records by fixed rules.'
                    : 'The AI service could not be reached, so this was compiled from the records by fixed rules.';
            }
        } else {
            $notes[] = 'AI is not switched on, so this was compiled from the records by fixed rules.';
        }

        return [...$this->checked($this->rules($employee, $signals)), 'engine' => 'rules', 'notes' => $notes];
    }

    private function checked(array $answer): array
    {
        $lines = fn ($value) => array_values(array_filter(array_map(fn ($line) => mb_substr(trim((string) $line), 0, 300), is_array($value) ? $value : [])));
        $recommendations = [];
        foreach (is_array($answer['recommendations'] ?? null) ? $answer['recommendations'] : [] as $one) {
            if (filled($one['title'] ?? null)) {
                $recommendations[] = [
                    'title' => mb_substr(trim((string) $one['title']), 0, 160),
                    'kind' => in_array($one['kind'] ?? '', DevelopmentAction::KINDS, true) ? $one['kind'] : 'Coaching',
                    'reason' => mb_substr(trim((string) ($one['reason'] ?? '')), 0, 300),
                ];
            }
        }

        return [
            'summary' => mb_substr(trim((string) ($answer['summary'] ?? '')), 0, 900),
            'achievements' => array_slice($lines($answer['achievements'] ?? []), 0, 6),
            'concerns' => array_slice($lines($answer['concerns'] ?? []), 0, 6),
            'patterns' => array_slice($lines($answer['patterns'] ?? []), 0, 6),
            'recommendations' => array_slice($recommendations, 0, 5),
        ];
    }

    private function ask(Employee $employee, array $signals, array $context): array
    {
        $kinds = implode(', ', DevelopmentAction::KINDS);
        $system = <<<TEXT
        You are an HR analyst for a law firm in Oman, writing a short management insight about one employee for their manager and HR.
        You are given facts and signals that the firm's system worked out from its own records. Write from those alone.

        Rules:
        - Never add a fact, a figure, a date or an event that is not in the data. If the data is thin, say that there is little on record rather than filling the gap.
        - Be fair and specific. State what the records show; do not speculate about motives, health or private life.
        - "summary": an executive summary of three to five sentences - who they are in the firm, how they are performing, what stands out, and the single most important thing for the manager to do.
        - "achievements": what went well (strong scores, improvement, completed development, a clean record). Empty if the data shows none.
        - "concerns": what needs the manager's attention, most serious first. Empty if none.
        - "patterns": things that repeat or move over time - a trend across evaluations, the same kind of violation recurring, how leave falls. Empty if none.
        - "recommendations": up to five concrete actions. Each has a short "title", a "kind" (one of: {$kinds}) and a one-sentence "reason" tied to the data. Recommend recognition for strong performers, not only corrections. Do not repeat an action already open in the development plan.
        - Plain English, no headings, no bullet characters inside strings.
        TEXT;

        $data = json_encode([
            'employee' => [
                'occupation' => $employee->occupation, 'department' => $employee->department, 'position' => $employee->position,
                'practiceLevel' => $employee->practice_level, 'status' => $employee->status,
            ],
            'standing' => $signals['standing'],
            'facts' => $signals['facts'],
            'signals' => $signals['signals'],
            ...$context,
        ], JSON_UNESCAPED_UNICODE);

        $answer = $this->ai->json($system, "The records, as JSON:\n".$data, Schema::object([
            'summary' => Schema::string(),
            'achievements' => Schema::list(Schema::string()),
            'concerns' => Schema::list(Schema::string()),
            'patterns' => Schema::list(Schema::string()),
            'recommendations' => Schema::list(Schema::object([
                'title' => Schema::string(),
                'kind' => Schema::string(enum: DevelopmentAction::KINDS),
                'reason' => Schema::string(),
            ])),
        ]));

        if (blank($answer['summary'] ?? null)) {
            throw new AiUnavailable('The AI service returned no summary.');
        }

        return $answer;
    }

    /** The same signals laid out without AI: nothing written that a rule did not find. */
    private function rules(Employee $employee, array $signals): array
    {
        $facts = $signals['facts'];
        $by = fn (string $level) => array_values(array_filter($signals['signals'], fn ($signal) => $signal['level'] === $level));
        $line = fn (array $signal) => $signal['title'].': '.$signal['detail'];

        $who = trim(($employee->occupation ?: 'Employee').($employee->department ? ' in '.$employee->department : ''));
        $summary = $who.($facts['tenureMonths'] !== null ? ', with the firm for '.self::tenure($facts['tenureMonths']) : '').'. ';
        $summary .= $facts['lastScore'] !== null
            ? "Last evaluated at {$facts['lastScore']} out of 5 ({$facts['lastRating']}) for {$facts['lastPeriod']}. "
            : 'No performance evaluation is on record yet. ';
        $summary .= match ($signals['standing']) {
            EmployeeSignals::HIGH => 'The records show a strong performer with nothing of concern.',
            EmployeeSignals::ATTENTION => 'The records show '.count($by('attention')).' matter'.(count($by('attention')) === 1 ? '' : 's').' that need the manager\'s attention.',
            EmployeeSignals::UNRATED => 'There is too little on record to judge performance; an evaluation is the first step.',
            default => 'The records show steady performance with nothing serious outstanding.',
        };

        $recommendations = [];
        foreach ($by('attention') as $signal) {
            $recommendations[] = match ($signal['area']) {
                'Conduct' => ['title' => 'Corrective plan: '.mb_strtolower(str_replace('Recurring: ', '', $signal['title'])), 'kind' => 'Corrective Action', 'reason' => $signal['detail']],
                'Attendance' => ['title' => 'Attendance review meeting', 'kind' => 'Coaching', 'reason' => $signal['detail']],
                'Performance' => ['title' => 'Performance improvement plan', 'kind' => 'Coaching', 'reason' => $signal['detail']],
                'Compliance' => ['title' => 'Renew expiring documents', 'kind' => 'Corrective Action', 'reason' => $signal['detail']],
                default => ['title' => 'Follow up overdue development actions', 'kind' => 'Coaching', 'reason' => $signal['detail']],
            };
        }
        if ($signals['standing'] === EmployeeSignals::HIGH) {
            $recommendations[] = ['title' => 'Recognise strong performance', 'kind' => 'Recognition', 'reason' => "Rated {$facts['lastScore']} out of 5 with a clean record."];
        }
        if ($facts['lastScore'] === null) {
            $recommendations[] = ['title' => 'Carry out a performance evaluation', 'kind' => 'Coaching', 'reason' => 'No evaluation is on record.'];
        }

        return [
            'summary' => $summary,
            'achievements' => array_map($line, $by('positive')),
            'concerns' => array_map($line, array_filter($by('attention'), fn ($signal) => ! str_starts_with($signal['title'], 'Recurring'))),
            'patterns' => array_map($line, array_filter($signals['signals'], fn ($signal) => str_starts_with($signal['title'], 'Recurring') || str_contains($signal['title'], 'declining') || str_contains($signal['title'], 'improving') || str_contains($signal['title'], 'beside the weekend'))),
            'recommendations' => collect($recommendations)->unique('title')->values()->all(),
        ];
    }

    private static function tenure(int $months): string
    {
        $years = intdiv($months, 12);

        return $years >= 1 ? $years.' year'.($years === 1 ? '' : 's') : $months.' month'.($months === 1 ? '' : 's');
    }
}
