<?php

namespace App\Services\Circulars;

use App\Http\Requests\Employees\EmployeeRequest;
use App\Models\Circular;
use App\Models\Employee;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;

/**
 * The AI side of circulars: a brief of each one (what it says, in short and
 * in plain words, what must be done, by when, and whom it touches), and
 * answers to an employee's questions about it.
 *
 * Everything is written from the circular's own text. The AI is told to add
 * nothing - an instruction that is not in the circular must never appear in
 * its brief - and to say so when the circular does not answer a question.
 * With no key, or when the service does not answer, a plain reading of the
 * text is given instead and says that it is one.
 */
final class CircularAnalyst
{
    public function __construct(private AiClient $ai) {}

    /**
     * @return array{engine:string,summary:string,plainLanguage:string,keyPoints:list<string>,actions:list<array{action:string,who:string,deadline:?string}>,deadlines:list<array{date:?string,label:string}>,affectedDepartments:list<string>,affectedRoles:list<string>,notes:list<string>}
     */
    public function brief(Circular $circular): array
    {
        $notes = [];
        if ($this->ai->available()) {
            try {
                return [...$this->checked($this->writeBrief($circular)), 'engine' => $this->ai->engine(), 'notes' => []];
            } catch (AiUnavailable $down) {
                $notes[] = $down->getCode() === 429
                    ? 'The AI usage limit has been reached for now, so this is a plain reading of the text.'
                    : 'The AI service could not be reached, so this is a plain reading of the text.';
            }
        } else {
            $notes[] = 'AI is not switched on, so this is a plain reading of the text.';
        }

        return [...$this->checked($this->plainBrief($circular)), 'engine' => 'rules', 'notes' => $notes];
    }

    /** @return array{engine:string,answer:string,notes:list<string>} */
    public function answer(Circular $circular, ?Employee $employee, ?string $question): array
    {
        $question = trim((string) $question) ?: 'What does this circular mean for me and my work? What do I have to do, and by when?';

        if ($this->ai->available()) {
            try {
                return ['engine' => $this->ai->engine(), 'answer' => $this->writeAnswer($circular, $employee, $question), 'notes' => []];
            } catch (AiUnavailable) {
                // Falls through to the circular's own words.
            }
        }

        // Without AI nothing is made up: the circular's own words, and who to ask.
        return [
            'engine' => 'rules',
            'answer' => 'The circular says: "'.trim($circular->content).'" For anything it does not make clear, ask '.($circular->issuer?->name ?: 'the administration').', who issued it.',
            'notes' => ['The AI is not available at the moment, so the circular is quoted as written.'],
        ];
    }

    /* ------------------------------------------------------------ shape */

    private function checked(array $answer): array
    {
        $text = fn ($value, int $max) => mb_substr(trim((string) $value), 0, $max);
        $lines = fn ($value, int $count) => array_slice(array_values(array_filter(array_map(fn ($line) => $text($line, 300), is_array($value) ? $value : []))), 0, $count);
        $date = fn ($value) => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) && strtotime($value) ? $value : null;

        $actions = [];
        foreach (is_array($answer['actions'] ?? null) ? $answer['actions'] : [] as $one) {
            if (filled($one['action'] ?? null)) {
                $actions[] = ['action' => $text($one['action'], 300), 'who' => $text($one['who'] ?? '', 80) ?: 'Everyone it was issued to', 'deadline' => $date($one['deadline'] ?? null)];
            }
        }
        $deadlines = [];
        foreach (is_array($answer['deadlines'] ?? null) ? $answer['deadlines'] : [] as $one) {
            if (filled($one['label'] ?? null)) {
                $deadlines[] = ['date' => $date($one['date'] ?? null), 'label' => $text($one['label'], 200)];
            }
        }

        return [
            'summary' => $text($answer['summary'] ?? '', 500),
            'plainLanguage' => $text($answer['plainLanguage'] ?? '', 700),
            'keyPoints' => $lines($answer['keyPoints'] ?? [], 6),
            'actions' => array_slice($actions, 0, 6),
            'deadlines' => array_slice($deadlines, 0, 6),
            'affectedDepartments' => array_values(array_intersect(EmployeeRequest::DEPARTMENTS, is_array($answer['affectedDepartments'] ?? null) ? $answer['affectedDepartments'] : [])),
            'affectedRoles' => $lines($answer['affectedRoles'] ?? [], 6),
        ];
    }

    /* ----------------------------------------------------------- gemini */

    private function about(Circular $circular): string
    {
        return "Circular {$circular->circular_no}, dated {$circular->date->format('Y-m-d')}, issued to: {$circular->target_group}"
            .($circular->branch !== 'general' ? " ({$circular->branch} branch)" : '').".\n\nText of the circular:\n".$circular->content;
    }

    private function writeBrief(Circular $circular): array
    {
        $departments = implode(', ', EmployeeRequest::DEPARTMENTS);
        $system = <<<TEXT
        You read circulars issued by the management of a law firm in Oman and prepare a brief of each for the employees who receive it. The circular may be in English or Arabic; write the brief in English.

        Rules:
        - Use only what the circular says. Never add an instruction, a date, a consequence or a reason that is not in its text. If it gives no deadline, give none.
        - "summary": one or two sentences saying what the circular is.
        - "plainLanguage": the same in simple everyday words, as you would explain it to a new colleague - what changes for them, starting when.
        - "keyPoints": the points that matter, each one short sentence.
        - "actions": what the people it was issued to must do or stop doing. Each has "action", "who" (who must do it, in the circular's own terms) and "deadline" as YYYY-MM-DD only if the circular states one, else null.
        - "deadlines": every date or period the circular fixes, with "label" saying what happens then and "date" as YYYY-MM-DD when it is a single date (resolve it against the circular's own date), else null.
        - "affectedDepartments": the departments whose daily work this changes most, chosen only from: {$departments}. Empty when it touches everyone alike.
        - "affectedRoles": jobs it bears on most (for example "Lawyers", "Accountants"). Empty when it touches everyone alike.
        TEXT;

        $answer = $this->ai->json($system, $this->about($circular), Schema::object([
            'summary' => Schema::string(),
            'plainLanguage' => Schema::string(),
            'keyPoints' => Schema::list(Schema::string()),
            'actions' => Schema::list(Schema::object(['action' => Schema::string(), 'who' => Schema::string(), 'deadline' => Schema::string(nullable: true)])),
            'deadlines' => Schema::list(Schema::object(['date' => Schema::string(nullable: true), 'label' => Schema::string()])),
            'affectedDepartments' => Schema::list(Schema::string(enum: EmployeeRequest::DEPARTMENTS)),
            'affectedRoles' => Schema::list(Schema::string()),
        ]));

        if (blank($answer['summary'] ?? null)) {
            throw new AiUnavailable('The AI service returned no brief.');
        }

        return $answer;
    }

    private function writeAnswer(Circular $circular, ?Employee $employee, string $question): string
    {
        $who = $employee
            ? 'The person asking is a '.($employee->occupation ?: 'member of staff').($employee->department ? ' in '.$employee->department : '').($employee->branch ? ', '.$employee->branch.' branch' : '').'.'
            : '';

        $system = <<<'TEXT'
        You answer an employee's question about one circular issued by the management of a law firm in Oman.
        Answer from the circular's text alone, in plain English, in at most five short sentences. Say what it means for this person's own work where their job makes a difference.
        If the circular does not answer the question, say plainly that it does not, and suggest asking whoever issued it. Never invent an instruction, a date or a consequence, and do not give legal advice.
        TEXT;

        $answer = $this->ai->json($system, $this->about($circular)."\n\n{$who}\nQuestion: {$question}", Schema::object(['answer' => Schema::string()]));
        if (blank($answer['answer'] ?? null)) {
            throw new AiUnavailable('The AI service returned no answer.');
        }

        return mb_substr(trim((string) $answer['answer']), 0, 1200);
    }

    /* ------------------------------------------------------------ rules */

    /** Without AI: the circular's own sentences, sorted by what they are. */
    private function plainBrief(Circular $circular): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $circular->content));
        $sentences = array_values(array_filter(array_map('trim', preg_split('/(?<=[.!?؟])\s+/u', $text) ?: [])));

        $obliges = '/\b(must|shall|required|are to|is to|have to|need to|should|may not|not permitted|prohibited|no longer|please)\b/i';
        $actions = [];
        $deadlines = [];
        foreach ($sentences as $sentence) {
            $date = $this->dateIn($sentence, $circular);
            if (preg_match($obliges, $sentence)) {
                $actions[] = ['action' => $sentence, 'who' => $circular->target_group, 'deadline' => $date];
            }
            if ($date || preg_match('/\b(by|before|until|no later than|from|effective|starting|deadline)\b.*\d/i', $sentence)) {
                $deadlines[] = ['date' => $date, 'label' => $sentence];
            }
        }

        return [
            'summary' => $sentences[0] ?? $text,
            'plainLanguage' => '',
            'keyPoints' => array_slice($sentences, 0, 5),
            'actions' => $actions,
            'deadlines' => $deadlines,
            'affectedDepartments' => match ($circular->target_group) {
                'Administration' => ['Administration'],
                'Partners' => ['Partner'],
                'Lawyers' => ['Legal Services', 'Litigation', 'Advisory & Contracts'],
                'Accounting' => ['Finance'],
                default => [],
            },
            'affectedRoles' => $circular->target_group === 'All Employees' ? [] : [$circular->target_group],
        ];
    }

    /** The first date written in a sentence, as YYYY-MM-DD. */
    private function dateIn(string $sentence, Circular $circular): ?string
    {
        if (preg_match('/\b(\d{4})-(\d{2})-(\d{2})\b/', $sentence, $m)) {
            return "{$m[1]}-{$m[2]}-{$m[3]}";
        }
        if (preg_match('/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/', $sentence, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }
        $months = 'January|February|March|April|May|June|July|August|September|October|November|December';
        if (preg_match('/\b(\d{1,2})(?:st|nd|rd|th)?\s+('.$months.')(?:\s+(\d{4}))?\b/i', $sentence, $m)) {
            $stamp = strtotime($m[1].' '.$m[2].' '.($m[3] ?? $circular->date->format('Y')));

            return $stamp ? date('Y-m-d', $stamp) : null;
        }

        return null;
    }
}
