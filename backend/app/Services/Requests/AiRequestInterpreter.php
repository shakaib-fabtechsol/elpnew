<?php

namespace App\Services\Requests;

use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\GeneralRequest;
use App\Models\SalaryAdvance;
use Illuminate\Http\UploadedFile;

/**
 * What every AI reader has in common, whichever company's model does the
 * reading: the instructions it is given, the fields it may answer with, and
 * how its answer becomes a proposal. A reader only has to say how the
 * question is sent and how the reply comes back (ask()).
 *
 * Kept in one place so two readers cannot drift into reading the same
 * request two different ways.
 */
abstract class AiRequestInterpreter implements RequestInterpreter
{
    /** Documents the readers are sent inline (and the upload rule allows). */
    protected const READABLE = ['application/pdf', 'image/jpeg', 'image/png'];

    /** The name the proposal carries, so the screen can say who read it. */
    abstract protected function engine(): string;

    /**
     * Sends the question (and the document) and returns the model's answer,
     * decoded from JSON.
     *
     * @return array<string, mixed>
     *
     * @throws InterpreterUnavailable
     */
    abstract protected function ask(string $prompt, ?UploadedFile $file, array $facts): array;

    public function interpret(?string $text, ?UploadedFile $file, array $facts = []): array
    {
        return $this->proposal($this->ask("Employee's request:\n".(filled($text) ? $text : '(no text - see the attached document)'), $file, $facts));
    }

    public function revise(string $type, array $values, ?array $invoice, ?string $message, ?UploadedFile $file, array $facts = []): array
    {
        $draft = json_encode(['type' => $type, ...array_filter($values, fn ($value) => $value !== null), 'invoice' => $invoice], JSON_UNESCAPED_UNICODE);
        $said = filled($message) ? $message : '(no text - see the attached document)';

        return $this->proposal($this->ask(
            "The request drafted so far, as JSON:\n{$draft}\n\n"
            ."The employee now answers a question about it, or asks for a change:\n{$said}\n\n"
            .'Return the complete updated request. Keep every value the employee did not change, apply exactly what they said, '
            .'and keep the type unless they clearly ask for a different kind of request. "summary" describes the request as it now stands.',
            $file,
            $facts,
        ));
    }

    /** The model's answer as a proposal: only a known type, a bounded confidence. */
    protected function proposal(array $answer): array
    {
        $type = $answer['type'] ?? null;

        return [
            'type' => is_string($type) && isset(RequestCatalog::TYPES[$type]) ? $type : null,
            'confidence' => max(0.0, min(1.0, (float) ($answer['confidence'] ?? 0))),
            'summary' => mb_substr((string) ($answer['summary'] ?? ''), 0, 300),
            'fields' => array_diff_key($answer, array_flip(['type', 'confidence', 'summary', 'invoice'])),
            'invoice' => $answer['invoice'] ?? null,
            'engine' => $this->engine(),
        ];
    }

    protected function instructions(array $facts = []): string
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

    /**
     * Every field an answer may carry besides type, confidence and summary:
     * name => ['number'] or ['string', the options it is limited to, if any].
     * Each reader turns this into its own schema dialect.
     *
     * @return array<string, array{0: string, 1?: list<string>}>
     */
    protected function answerFields(): array
    {
        return [
            'amount' => ['number'],
            'monthly' => ['number'],
            'startMonth' => ['string'],
            'deductMonth' => ['string', SalaryAdvance::MONTHS],
            'deductYear' => ['string'],
            'purpose' => ['string', SalaryAdvance::PURPOSES],
            'assistanceType' => ['string', array_keys(AssistanceRequest::TYPES)],
            'beneficiary' => ['string', AssistanceRequest::BENEFICIARIES],
            'bonusSubcategory' => ['string', Bonus::SUBCATEGORIES],
            'hours' => ['number'],
            'period' => ['string'],
            'days' => ['number'],
            'year' => ['string'],
            'leaveType' => ['string', RequestCatalog::leaveTypes()],
            'fromDate' => ['string'],
            'toDate' => ['string'],
            'requestType' => ['string', array_values(array_unique(array_merge(...array_map(fn ($kind) => $kind[2], array_values(GeneralRequest::KINDS)))))],
            'insuranceCovered' => ['number'],
            'reason' => ['string'],
        ];
    }

    /** The invoice's own fields, the same way; its lines are name, quantity, amount. */
    protected function invoiceFields(): array
    {
        return [
            'invoiceNo' => ['string'],
            'invoiceDate' => ['string'],
            'supplierName' => ['string'],
            'supplierVat' => ['string'],
            'purpose' => ['string'],
            'subtotal' => ['number'],
            'vat' => ['number'],
            'total' => ['number'],
        ];
    }

    /** The kinds a request can be, and "unknown" for anything that is not one. */
    protected function typeOptions(): array
    {
        return [...array_keys(RequestCatalog::TYPES), 'unknown'];
    }
}
