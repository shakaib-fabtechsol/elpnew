<?php

namespace App\Services\Documents;

use App\Models\Employee;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;
use Illuminate\Http\UploadedFile;

/**
 * Reads one of a new employee's papers - a Civil ID, a passport, a contract,
 * a CV, a certificate, a lawyer card, a bank letter - into the fields of the
 * employee record, each with how sure the reading is.
 *
 * The AI says what kind of paper it is and what is printed on it; this class
 * decides what is kept. A field the form does not have is dropped, a date
 * that is not a date is dropped, and nothing is filled that the paper does
 * not show. The person adding the employee reviews every value before it is
 * saved.
 */
final class EmployeePaperReader
{
    /** The kinds of paper the intake knows (frontend documentIntake.js INTAKE_TYPES). */
    public const TYPES = ['civilId', 'passport', 'contract', 'cv', 'education', 'lawyerCard', 'bank', 'other'];

    /** field => how its value is checked. */
    private const FIELDS = [
        'employeeName' => 'text', 'arabicName' => 'text', 'dateOfBirth' => 'date', 'gender' => 'gender', 'nationality' => 'text',
        'personalEmail' => 'email', 'phone' => 'text', 'address' => 'text', 'emergencyName' => 'text', 'emergencyPhone' => 'text',
        'branch' => 'text', 'position' => 'text', 'department' => 'text', 'grade' => 'text', 'workEmail' => 'email',
        'occupation' => 'text', 'practiceLevel' => 'text',
        'employmentType' => 'text', 'contractType' => 'text', 'dateOfJoining' => 'date', 'noticePeriod' => 'text',
        'civilId' => 'text', 'idExpiry' => 'date', 'passportNumber' => 'text', 'passportExpiry' => 'date',
        'lawyerCardNo' => 'text', 'lawyerCardExpiry' => 'date',
        'salary' => 'money', 'housing' => 'money', 'transport' => 'money',
        'bankName' => 'text', 'accountNumber' => 'text', 'iban' => 'text', 'swiftCode' => 'text',
        'spRegistrationNo' => 'text', 'spRegistrationDate' => 'date',
    ];

    public function __construct(private AiClient $ai) {}

    public function available(): bool
    {
        return $this->ai->available();
    }

    /**
     * @return array{typeKey:string,fields:array<string,array{value:string,confidence:int}>,qualification:?array<string,string>,engine:string}
     *
     * @throws AiUnavailable
     */
    public function read(UploadedFile $file, ?string $typeKey = null): array
    {
        $kinds = implode(', ', self::TYPES);
        $fields = implode(', ', array_keys(self::FIELDS));
        $said = $typeKey ? "The person uploading says this is: {$typeKey}. Read it as that kind." : 'Work out which kind of paper it is.';

        $instructions = <<<TEXT
        You read one document from the personnel file of a new employee of a law firm in Oman and return what is printed on it. The document may be in Arabic, English or both.

        {$said}
        "typeKey" is one of: {$kinds}. civilId is an Omani civil ID or resident card; lawyerCard is a lawyers' register / bar card; bank is a bank letter, statement or card showing an account; education is a degree or certificate.

        "fields" lists every value the paper shows, each as {"key", "value", "confidence"}. "key" is one of: {$fields}.
        - Return only what is actually printed. Never guess or complete a value; leave a field out if it is not there or cannot be read.
        - employeeName is the full name in Latin letters exactly as printed, arabicName the full name in Arabic letters.
        - Dates are YYYY-MM-DD. gender is "Male" or "Female". Amounts (salary, housing, transport) are numbers in Omani rials without a currency.
        - civilId, passportNumber, lawyerCardNo, accountNumber, iban and swiftCode are copied character for character.
        - contractType is "Fixed-term" or "Indefinite-term"; employmentType is "Full-Time" or "Part-Time"; noticePeriod as written (for example "1 Month").
        - "confidence" is how sure you are of that one value, from 0 to 100; lower it for anything blurred, cut off or ambiguous.
        "qualification" is filled only for an educational certificate: the degree, the specialization, the institution and the year as printed; otherwise null.
        TEXT;

        $answer = $this->ai->json($instructions, 'Read the attached document.', Schema::object([
            'typeKey' => Schema::string(enum: self::TYPES),
            'fields' => Schema::list(Schema::object([
                'key' => Schema::string(enum: array_keys(self::FIELDS)),
                'value' => Schema::string(),
                'confidence' => Schema::number(),
            ])),
            'qualification' => Schema::object([
                'degree' => Schema::string(nullable: true),
                'specialization' => Schema::string(nullable: true),
                'institution' => Schema::string(nullable: true),
                'year' => Schema::string(nullable: true),
            ], nullable: true),
        ]), $file);

        $kind = in_array($answer['typeKey'] ?? null, self::TYPES, true) ? $answer['typeKey'] : ($typeKey ?: 'other');

        $read = [];
        foreach ((array) ($answer['fields'] ?? []) as $field) {
            $key = $field['key'] ?? null;
            $value = isset(self::FIELDS[$key]) ? $this->clean(self::FIELDS[$key], $field['value'] ?? null) : null;
            if ($value !== null) {
                $read[$key] = ['value' => $value, 'confidence' => max(0, min(100, (int) round((float) ($field['confidence'] ?? 0))))];
            }
        }

        $qualification = null;
        if ($kind === 'education' && is_array($answer['qualification'] ?? null)) {
            $qualification = array_map(fn ($value) => mb_substr(trim((string) $value), 0, 160), array_intersect_key($answer['qualification'], array_flip(['degree', 'specialization', 'institution', 'year'])));
            $qualification = array_filter($qualification) ? $qualification : null;
        }

        return ['typeKey' => $kind, 'fields' => $read, 'qualification' => $qualification, 'engine' => $this->ai->engine()];
    }

    private function clean(string $kind, mixed $raw): ?string
    {
        $value = trim((string) $raw);
        if ($value === '') {
            return null;
        }

        return match ($kind) {
            'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) && strtotime($value) ? $value : null,
            'gender' => in_array(ucfirst(mb_strtolower($value)), ['Male', 'Female'], true) ? ucfirst(mb_strtolower($value)) : null,
            'email' => filter_var($value, FILTER_VALIDATE_EMAIL) ? mb_strtolower($value) : null,
            'money' => is_numeric(str_replace(',', '', $value)) && (float) str_replace(',', '', $value) > 0
                ? number_format((float) str_replace(',', '', $value), 3, '.', '') : null,
            default => mb_substr($value, 0, 255),
        };
    }

    /** Whether somebody already on file carries this civil ID - said before the record is saved. */
    public static function alreadyOnFile(?string $civilId): ?Employee
    {
        return filled($civilId) ? Employee::where('civil_id', $civilId)->first() : null;
    }
}
