<?php

namespace App\Services\Documents\Standard;

use Illuminate\Http\UploadedFile;

/**
 * Reads an employee's paper without AI: the text is taken off it (PDF text
 * or OCR, see TextExtractor), a passport's or ID card's machine-readable zone
 * is decoded with its check digits (Mrz), and the rest is found by the labels
 * printed beside each value and by the patterns the values themselves follow.
 *
 * Five papers are read this way: the Civil ID, the passport, the lawyer card,
 * the employment contract and the CV. The answer has the same shape as the AI
 * reading (EmployeePaperReader) - each value with how sure the reading is -
 * so Add Employee puts every value into its own editable field, marked for
 * review where the reading is unsure, and nothing is saved until the person
 * adding the employee saves.
 *
 *   98  a machine-readable value whose check digit passed
 *   90  a value found beside its printed label
 *   75  a value worked out from a keyword (a court level, a contract term)
 *   65  a value found by its pattern alone, with no label to vouch for it
 */
final class StandardPaperReader
{
    /** The papers read by these rules (keys of documentIntake.js INTAKE_TYPES). */
    public const TYPES = ['civilId', 'passport', 'lawyerCard', 'contract', 'cv'];

    private const LABELLED = 90;

    private const KEYWORD = 75;

    private const PATTERN = 65;

    /** The form's own option lists (frontend lib/constants.js, PersonalExtras.jsx). */
    private const JOB_TITLES = [
        'Judicial' => ['Founding Partner', 'Managing Partner', 'Partner', 'Legal Consultant', 'Legal Associate', 'Trainee Lawyer', 'Legal Intern', 'Lawyer'],
        'Administrative' => ['Administrative Assistant', 'Administrative Intern', 'Administrator', 'HR Officer', 'IT Officer'],
        'Financial / Accounting' => ['Senior Accountant', 'Accounting Intern', 'Finance Officer', 'Accountant'],
    ];

    private const LANGUAGES = ['Arabic', 'English', 'French', 'Hindi', 'Urdu', 'Swahili', 'Persian', 'German', 'Spanish', 'Chinese'];

    public function __construct(private TextExtractor $extractor) {}

    public static function reads(?string $typeKey): bool
    {
        return in_array($typeKey, self::TYPES, true);
    }

    /**
     * @return array{typeKey:string,fields:array<string,array{value:mixed,confidence:int}>,qualification:?array<string,string>,engine:string,method:string}
     *
     * @throws OcrUnavailable
     */
    public function read(UploadedFile $file, ?string $typeKey = null): array
    {
        $text = $this->extractor->extract($file);

        return [...$this->readText($text['text'], $text['mrzText'], $typeKey), 'method' => $text['method']];
    }

    /**
     * The reading of text already taken off a paper - kept apart from the OCR
     * so the rules can be checked on their own.
     */
    public function readText(string $text, string $mrzText = '', ?string $typeKey = null): array
    {
        $text = $this->normalise($text);
        $mrz = Mrz::find($mrzText !== '' ? $mrzText : $text) ?? ($mrzText !== '' ? Mrz::find($text) : null);
        $kind = self::reads($typeKey) ? $typeKey : $this->classify($text, $mrz);

        $fields = match ($kind) {
            'civilId' => $this->civilId($text, $mrz),
            'passport' => $this->passport($text, $mrz),
            'lawyerCard' => $this->lawyerCard($text),
            'contract' => $this->contract($text),
            'cv' => $this->cv($text),
            default => [],
        };
        $qualification = $kind === 'cv' ? $this->qualification($text) : null;

        return ['typeKey' => $kind ?? 'other', 'fields' => $fields, 'qualification' => $qualification, 'engine' => 'standard'];
    }

    /* ------------------------------------------------------------ which paper */

    private function classify(string $text, ?array $mrz): ?string
    {
        if ($mrz['format'] ?? null) {
            return $mrz['format'] === 'TD3' ? 'passport' : 'civilId';
        }
        $has = fn (string $pattern) => (bool) preg_match($pattern.'iu', $text);

        // A CV is known by its sections as much as by its title.
        $sections = preg_match_all('/^\s*(profile|summary|objective|experience|work experience|employment history|education|qualifications|skills|languages|references)\s*:?\s*$/imu', $text);

        return match (true) {
            $has('/\b(curriculum vitae|resume|résumé)\b|السيرة الذاتية/') || $sections >= 2 => 'cv',
            $has('/\b(employment (contract|agreement)|contract of employment)\b|عقد عمل/') => 'contract',
            $has('/\b(bar association|lawyers? (register|card)|advocate card)\b|نقابة المحامين|جمعية المحامين|بطاقة محام/')
                || ($has('/\b(lawyer|advocate)\b|محام/') && $has('/\b(registration|card|licen[cs]e|membership)\s*(no|number)/')) => 'lawyerCard',
            $has('/\bpassport\b|جواز سفر/') => 'passport',
            $has('/\b(civil (no|number|id)|resident card|identity card)\b|الرقم المدني|البطاقة الشخصية|بطاقة مقيم/') => 'civilId',
            $has('/\b(education|experience|skills)\b/') && $has('/\b(experience)\b/') => 'cv',
            default => null,
        };
    }

    /* ------------------------------------------------------------ the papers */

    private function civilId(string $text, ?array $mrz): array
    {
        $fields = [];
        $this->put($fields, 'civilId', $this->labelled($text, 'civil\s*(?:id\s*)?(?:no\.?|number)|id\s*(?:no\.?|number)|الرقم المدني', '(\d{6,10})'));
        if (! isset($fields['civilId']) && preg_match('/\b(\d{8,9})\b/', $text, $m)) {
            $fields['civilId'] = ['value' => $m[1], 'confidence' => self::PATTERN];
        }
        $this->put($fields, 'employeeName', $this->name($this->labelled($text, '(?:full\s*)?name', '([A-Za-z][A-Za-z\' .-]{3,80})')));
        $this->put($fields, 'arabicName', $this->arabicName($text));
        $this->put($fields, 'dateOfBirth', $this->dateAt($text, 'date\s*of\s*birth|birth\s*date|d\.?o\.?b|تاريخ الميلاد'));
        $this->put($fields, 'idExpiry', $this->dateAt($text, 'expiry\s*date|date\s*of\s*expiry|expiry|valid\s*(?:until|till|thru)|تاريخ الانتهاء|تاريخ الإنتهاء'));
        $this->put($fields, 'gender', $this->gender($text), self::KEYWORD);
        $this->put($fields, 'nationality', Nationality::inText($text), self::KEYWORD);

        return $this->overlay($fields, $mrz['format'] ?? null ? $mrz['fields'] : []);
    }

    private function passport(string $text, ?array $mrz): array
    {
        $fields = [];
        $this->put($fields, 'passportNumber', $this->labelled($text, 'passport\s*(?:no\.?|number)|رقم الجواز', '([A-Z0-9]{6,9})'));
        $surname = $this->labelled($text, 'surname|family\s*name', '([A-Za-z][A-Za-z\' -]{1,40})');
        $given = $this->labelled($text, 'given\s*names?|first\s*name', '([A-Za-z][A-Za-z\' -]{1,60})');
        if ($surname && $given) {
            $this->put($fields, 'employeeName', $this->name([
                'value' => $given['value'].' '.$surname['value'],
                'confidence' => min($given['confidence'], $surname['confidence']),
            ]));
        }
        $this->put($fields, 'dateOfBirth', $this->dateAt($text, 'date\s*of\s*birth|birth|تاريخ الميلاد'));
        $this->put($fields, 'passportExpiry', $this->dateAt($text, 'date\s*of\s*expiry|expiry|valid\s*until|تاريخ الانتهاء'));
        $this->put($fields, 'gender', $this->gender($text), self::KEYWORD);
        $this->put($fields, 'nationality', Nationality::inText($text), self::KEYWORD);

        // The machine-readable zone is the passport's own record of its
        // numbers and dates. The name is taken as printed where it is: the
        // zone cuts long names short and spells them without their marks.
        $zone = ($mrz['format'] ?? null) === 'TD3' ? $mrz['fields'] : [];
        if (isset($fields['employeeName'])) {
            unset($zone['employeeName']);
        }

        return $this->overlay($fields, $zone);
    }

    private function lawyerCard(string $text): array
    {
        $fields = [];
        $this->put($fields, 'lawyerCardNo', $this->labelled($text,
            '(?:card|registration|reg\.?|membership|licen[cs]e|enrol+ment)\s*(?:no\.?|number|#)|رقم القيد|رقم البطاقة|رقم الترخيص|رقم العضوية',
            '([A-Z0-9][A-Z0-9\/-]{2,19})'));
        $this->put($fields, 'employeeName', $this->name($this->labelled($text, '(?:lawyer\'?s?\s*)?name', '([A-Za-z][A-Za-z\' .-]{3,80})')));
        $this->put($fields, 'arabicName', $this->arabicName($text));
        $this->put($fields, 'lawyerCardExpiry', $this->dateAt($text, 'expiry\s*date|date\s*of\s*expiry|expiry|valid\s*(?:until|till|thru)|expires|تاريخ الانتهاء|صالحة? حتى'));
        $this->put($fields, 'civilId', $this->labelled($text, 'civil\s*(?:id\s*)?(?:no\.?|number)|الرقم المدني', '(\d{6,10})'));
        if ($grade = $this->courtLevel($text)) {
            $fields['practiceLevel'] = ['value' => $grade, 'confidence' => self::KEYWORD];
            $fields['grade'] = ['value' => $grade, 'confidence' => self::KEYWORD];
            $fields['occupation'] ??= ['value' => $grade === 'Trainee Lawyer' ? 'Trainee Lawyer' : 'Lawyer', 'confidence' => self::KEYWORD];
            $fields['department'] = ['value' => 'Judicial', 'confidence' => self::KEYWORD];
        }

        return $fields;
    }

    private function contract(string $text): array
    {
        $fields = [];
        $this->put($fields, 'employeeName', $this->name($this->labelled($text,
            'employee\s*name|name\s*of\s*(?:the\s*)?employee|second\s*party|the\s*employee',
            '(?:(?:mr|mrs|ms|miss)\.?\s+)?([A-Za-z][A-Za-z\' .-]{3,60})')));
        $this->put($fields, 'civilId', $this->labelled($text, 'civil\s*(?:id\s*)?(?:no\.?|number)|الرقم المدني', '(\d{6,10})'));

        $title = $this->labelled($text, 'position|job\s*title|designation|occupation|employed\s*as(?:\s*an?)?|post', '([A-Za-z][A-Za-z \/&-]{2,60})');
        if ($title && ($match = $this->jobTitle($title['value']))) {
            $fields['occupation'] = ['value' => $match['title'], 'confidence' => self::LABELLED];
            $fields['department'] = ['value' => $match['circle'], 'confidence' => self::KEYWORD];
        }
        $this->put($fields, 'department', $this->circle($this->labelled($text, 'department|circle|division', '([A-Za-z][A-Za-z \/&-]{2,40})')));

        $this->put($fields, 'dateOfJoining', $this->dateAt($text,
            'commencement\s*date|start(?:ing)?\s*date|date\s*of\s*joining|joining\s*date|effective\s*(?:date|from)|commenc(?:e|es|ing)\s*on|starting\s*(?:from|on)|تاريخ المباشرة|تاريخ بدء'));

        $this->put($fields, 'salary', $this->money($text, 'basic\s*(?:monthly\s*)?salary|basic\s*pay|الراتب الأساسي'));
        $this->put($fields, 'housing', $this->money($text, 'housing\s*allowance|accommodation\s*allowance|بدل سكن'));
        $this->put($fields, 'transport', $this->money($text, 'transport(?:ation)?\s*allowance|بدل نقل|بدل مواصلات'));

        $lower = mb_strtolower($text);
        $term = match (true) {
            (bool) preg_match('/\b(indefinite|unlimited|open[- ]ended|unspecified)\b|غير محدد/u', $lower) => 'Indefinite-term',
            (bool) preg_match('/\b(fixed|limited|definite)[- ]term\b|\bfor a (fixed|limited) (term|period)\b|محدد المدة/u', $lower) => 'Fixed-term',
            default => null,
        };
        $this->put($fields, 'contractType', $term, self::KEYWORD);
        $this->put($fields, 'employmentType', match (true) {
            str_contains($lower, 'part-time') || str_contains($lower, 'part time') => 'Part-Time',
            str_contains($lower, 'full-time') || str_contains($lower, 'full time') => 'Full-Time',
            default => null,
        }, self::KEYWORD);
        $this->put($fields, 'noticePeriod', $this->notice($lower), self::KEYWORD);

        return $fields;
    }

    private function cv(string $text): array
    {
        $fields = [];
        $lines = $this->lines($text);

        $named = $this->name($this->labelled($text, 'full\s*name|name', '([A-Za-z][A-Za-z\' .-]{3,60})'));
        if (! $named) {
            // A CV opens with the person's name: the first line that is only a name.
            foreach (array_slice($lines, 0, 6) as $line) {
                if (preg_match('/^[A-Z][A-Za-z\'.-]+(?:\s+[A-Z][A-Za-z\'.-]+){1,4}$/', $line)
                    && ! preg_match('/\b(curriculum|vitae|resume|profile|summary|contact|lawyer|consultant|accountant|officer|partner)\b/i', $line)) {
                    $named = ['value' => $line, 'confidence' => self::PATTERN];
                    break;
                }
            }
        }
        $this->put($fields, 'employeeName', $named);

        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $text, $m)) {
            $fields['personalEmail'] = ['value' => mb_strtolower($m[0]), 'confidence' => self::LABELLED];
        }
        if (preg_match('/(?:\+|00)\s?968[\s-]?\d{4}[\s-]?\d{4}|\b[279]\d{3}[\s-]?\d{4}\b|(?:\+|00)\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/', $text, $m)) {
            // An Omani number without its country code: the form keeps
            // the code in a box of its own (+968 by default).
            $phone = trim(preg_replace('/\s+/', ' ', preg_replace('/[^\d+ ]/', ' ', $m[0])));
            $phone = trim(preg_replace('/^(?:\+|00)\s?968\s?/', '', $phone));
            $fields['phone'] = ['value' => $phone, 'confidence' => self::PATTERN];
        }
        $this->put($fields, 'address', $this->labelled($text, 'address', '(.{5,120})'));

        // The job named nearest the top is the one the person holds now: the
        // first line that names one, not the longest title anywhere.
        foreach (array_slice($lines, 0, 15) as $line) {
            if ($match = $this->jobTitle($line)) {
                $fields['occupation'] = ['value' => $match['title'], 'confidence' => self::KEYWORD];
                $fields['department'] = ['value' => $match['circle'], 'confidence' => self::KEYWORD];
                break;
            }
        }
        if (($fields['department']['value'] ?? null) === 'Judicial' && ($grade = $this->courtLevel($text))) {
            $fields['practiceLevel'] = ['value' => $grade, 'confidence' => self::KEYWORD];
            $fields['grade'] = ['value' => $grade, 'confidence' => self::KEYWORD];
        }

        $this->put($fields, 'highestEducation', $this->educationLevel($text), self::KEYWORD);

        $languages = array_values(array_filter(self::LANGUAGES, fn ($language) => preg_match('/\b'.$language.'\b/i', $text)));
        if ($languages) {
            $fields['languages'] = ['value' => $languages, 'confidence' => self::KEYWORD];
        }

        $this->put($fields, 'cvSummary', $this->section($text, 'professional\s*summary|profile|summary|objective|about\s*me'), self::LABELLED);

        return $fields;
    }

    /** The degree on a CV: its level, subject, institution and year, for the CV paragraph. */
    private function qualification(string $text): ?array
    {
        $degree = null;
        foreach ($this->lines($text) as $line) {
            if (preg_match('/\b(ph\.?d|doctor(?:ate)? of|master(?:\'s)?|ll\.?m|mba|bachelor(?:\'s)?|ll\.?b|diploma)\b/i', $line)) {
                $degree = $line;
                break;
            }
        }
        if (! $degree) {
            return null;
        }
        // "Master of Laws in Commercial Law": the subject is what follows "in"
        // where there is one, "of" otherwise.
        $end = '(?:\s*[,(\-–|]|\s+\d|\s+from|$)';
        preg_match('/\bin\s+([A-Z][A-Za-z ]{2,40}?)'.$end.'/', $degree, $subject)
            || preg_match('/\bof\s+([A-Z][A-Za-z ]{2,40}?)'.$end.'/', $degree, $subject);
        preg_match('/\b(19[7-9]\d|20[0-4]\d)\b/', $degree, $year);
        $institution = null;
        foreach ($this->lines($text) as $line) {
            if (preg_match('/\b(university|college|institute|school of law|academy)\b|جامعة|كلية/iu', $line)) {
                $institution = trim(preg_replace('/\b(19[7-9]\d|20[0-4]\d)\b|[|–-]\s*$/', '', $line), " ,|–-\t");
                $year = $year ?: (preg_match('/\b(19[7-9]\d|20[0-4]\d)\b/', $line, $y) ? $y : []);
                break;
            }
        }

        return array_filter([
            'degree' => mb_substr(trim($degree), 0, 160),
            'specialization' => isset($subject[1]) ? trim($subject[1]) : null,
            'institution' => $institution ? mb_substr($institution, 0, 160) : null,
            'year' => $year[1] ?? null,
        ]) ?: null;
    }

    /* ------------------------------------------------------------ finding values */

    /**
     * The value printed beside a label - after it on the same line, or on the
     * line under it.
     *
     * @return array{value:string,confidence:int}|null
     */
    private function labelled(string $text, string $labels, string $value): ?array
    {
        $after = '(?:\s*[:：\-–.]\s*|\s+)';
        foreach ([
            ['/(?:'.$labels.')'.$after.$value.'/iu', self::LABELLED],
            ['/(?:'.$labels.')\s*[:：]?\s*\R\s*'.$value.'/iu', self::LABELLED - 5],
        ] as [$pattern, $confidence]) {
            preg_match_all($pattern, $text, $matches);
            foreach ($matches[1] as $found) {
                if ($this->isValue(trim($found))) {
                    return ['value' => trim($found), 'confidence' => $confidence];
                }
            }
        }

        return null;
    }

    /**
     * Whether what follows a label is its value - not the next label (cards
     * printed in two columns), nor wording such as "the employee named below".
     */
    private function isValue(string $found): bool
    {
        return $found !== ''
            && ! preg_match('/^(?:name|full name|date|birth|sex|gender|nationality|expiry|civil|registration|court|valid|card|passport|surname|given|position|department|address|number|no\b)/i', $found)
            && ! preg_match('/\b(?:named|below|above|hereinafter|referred|mentioned)\b/i', $found);
    }

    /** A date beside its label, as YYYY-MM-DD. */
    private function dateAt(string $text, string $labels): ?array
    {
        $date = '(\d{1,2}[\/.\- ]\d{1,2}[\/.\- ]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}[\s\-]+[A-Za-z]{3,9}[\s,\-]+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})';
        $found = $this->labelled($text, $labels, $date);
        $value = $found ? self::date($found['value']) : null;

        return $value ? ['value' => $value, 'confidence' => $found['confidence']] : null;
    }

    /** "12/03/2026", "2026-03-12", "12 March 2026", "March 12, 2026" as 2026-03-12. */
    public static function date(string $raw): ?string
    {
        $raw = trim($raw);
        if (preg_match('/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/', $raw, $m)) {
            [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
        } elseif (preg_match('/^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/', $raw, $m)) {
            // Day first, as Oman writes dates.
            [$d, $mo, $y] = [(int) $m[1], (int) $m[2], (int) $m[3]];
            $y = $y < 100 ? 2000 + $y : $y;
        } elseif (($time = strtotime($raw)) !== false) {
            return date('Y-m-d', $time);
        } else {
            return null;
        }

        return checkdate($mo, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $mo, $d) : null;
    }

    /** An amount beside its label, as rials with three decimals. */
    private function money(string $text, string $labels): ?array
    {
        $found = $this->labelled($text, $labels, '(?:(?:OMR|RO|R\.O\.?|ر\.ع\.?)\s*)?([\d,]+(?:\.\d{1,3})?)');
        if (! $found) {
            return null;
        }
        $amount = (float) str_replace(',', '', $found['value']);

        return $amount > 0 ? ['value' => number_format($amount, 3, '.', ''), 'confidence' => $found['confidence']] : null;
    }

    private function notice(string $lower): ?string
    {
        $words = ['one' => 1, 'two' => 2, 'three' => 3, 'four' => 4];
        if (preg_match('/(\d+|one|two|three|four)\s*(?:\(\d+\)\s*)?months?\'?\s*(?:prior\s*)?(?:written\s*)?notice|notice\s*period\s*(?:of|:)?\s*(\d+|one|two|three|four)\s*(?:\(\d+\)\s*)?months?/', $lower, $m)) {
            $n = $m[1] !== '' ? $m[1] : $m[2];
            $months = $words[$n] ?? (int) $n;

            return $months >= 1 && $months <= 4 ? $months.' Month'.($months > 1 ? 's' : '') : null;
        }

        return null;
    }

    /** The court level a lawyer is admitted to, as the form names it. */
    private function courtLevel(string $text): ?string
    {
        $lower = mb_strtolower($text);

        return match (true) {
            (bool) preg_match('/non[- ]?practi[cs]ing|غير المشتغلين/u', $lower) => 'Non-Practicing Lawyer',
            (bool) preg_match('/supreme\s*court|المحكمة العليا|العليا/u', $lower) => 'Supreme Court Lawyer',
            (bool) preg_match('/appeal|استئناف/u', $lower) => 'Appeal Court Lawyer',
            (bool) preg_match('/primary\s*court|first\s*instance|ابتدائي/u', $lower) => 'Primary Court Lawyer',
            (bool) preg_match('/trainee|under\s*training|متدرب|تحت التمرين/u', $lower) => 'Trainee Lawyer',
            default => null,
        };
    }

    private function educationLevel(string $text): ?string
    {
        return match (true) {
            (bool) preg_match('/\bph\.?d\b|\bdoctorate\b|\bdoctor of\b|دكتوراه/iu', $text) => 'Doctorate (PhD)',
            (bool) preg_match('/\bmaster\'?s?\b|\bll\.?m\b|\bmba\b|ماجستير/iu', $text) => "Master's Degree",
            (bool) preg_match('/\bbachelor\'?s?\b|\bll\.?b\b|\bb\.?sc\b|\bb\.?a\b|بكالوريوس|ليسانس/iu', $text) => "Bachelor's Degree",
            (bool) preg_match('/\bdiploma\b|دبلوم/iu', $text) => 'Diploma',
            (bool) preg_match('/\bsecondary\b|\bhigh school\b|الثانوية/iu', $text) => 'Secondary School',
            default => null,
        };
    }

    /** A job title the form offers, found in the text, with its circle - the longest title first. */
    private function jobTitle(string $text): ?array
    {
        $all = [];
        foreach (self::JOB_TITLES as $circle => $titles) {
            foreach ($titles as $title) {
                $all[$title] = $circle;
            }
        }
        uksort($all, fn ($a, $b) => strlen($b) - strlen($a));
        foreach ($all as $title => $circle) {
            if (preg_match('/\b'.preg_quote($title, '/').'\b/i', $text)) {
                return ['title' => $title, 'circle' => $circle];
            }
        }

        return null;
    }

    private function circle(?array $found): ?array
    {
        if (! $found) {
            return null;
        }
        $value = mb_strtolower($found['value']);
        $circle = match (true) {
            str_contains($value, 'judicial') || str_contains($value, 'legal') => 'Judicial',
            str_contains($value, 'admin') || str_contains($value, 'human') => 'Administrative',
            str_contains($value, 'financ') || str_contains($value, 'account') => 'Financial / Accounting',
            default => null,
        };

        return $circle ? ['value' => $circle, 'confidence' => $found['confidence']] : null;
    }

    /** A Latin name as the form keeps it: words in title case, no stray marks. */
    private function name(?array $found): ?array
    {
        if (! $found) {
            return null;
        }
        $words = preg_split('/\s+/', trim(preg_replace('/[^A-Za-z\' -]/', ' ', $found['value'])));
        $words = array_values(array_filter($words, fn ($w) => strlen($w) > 1 || $w === 'A'));
        if (count($words) < 2 || count($words) > 7) {
            return null;
        }

        return ['value' => ucwords(strtolower(implode(' ', $words))), 'confidence' => $found['confidence']];
    }

    /** The name in Arabic letters: beside its label, or the first line that is a name in Arabic. */
    private function arabicName(string $text): ?array
    {
        if (preg_match('/(?:الاسم|اسم)\s*[:：]?\s*([\x{0621}-\x{064A}\s]{6,80})/u', $text, $m) && count(preg_split('/\s+/u', trim($m[1]))) >= 2) {
            return ['value' => trim(preg_replace('/\s+/u', ' ', $m[1])), 'confidence' => self::LABELLED];
        }
        foreach ($this->lines($text) as $line) {
            if (preg_match('/^[\x{0621}-\x{064A}\s]+$/u', $line)
                && count(preg_split('/\s+/u', $line)) >= 3
                && ! preg_match('/سلطنة|عمان|البطاقة|الشخصية|شرطة|وزارة|جمعية|المحامين|بطاقة/u', $line)) {
                return ['value' => $line, 'confidence' => self::PATTERN];
            }
        }

        return null;
    }

    private function gender(string $text): ?string
    {
        return match (true) {
            (bool) preg_match('/\bfemale\b|أنثى|انثى/iu', $text) => 'Female',
            (bool) preg_match('/\bmale\b|ذكر/iu', $text) => 'Male',
            (bool) preg_match('/\b(?:sex|gender)\s*[:\/]?\s*F\b/i', $text) => 'Female',
            (bool) preg_match('/\b(?:sex|gender)\s*[:\/]?\s*M\b/i', $text) => 'Male',
            default => null,
        };
    }

    /** The paragraph under a heading, up to the next heading. */
    private function section(string $text, string $headings): ?array
    {
        $lines = $this->lines($text);
        foreach ($lines as $i => $line) {
            if (preg_match('/^(?:'.$headings.')\s*:?$/iu', $line)) {
                $body = [];
                foreach (array_slice($lines, $i + 1) as $next) {
                    // The next heading: a short line, all capitals or ending in a colon.
                    if (mb_strlen($next) < 40 && (preg_match('/^[A-Z &\/]+$/', $next) || str_ends_with($next, ':'))) {
                        break;
                    }
                    $body[] = $next;
                }
                $paragraph = trim(implode(' ', $body));

                return $paragraph !== '' ? ['value' => mb_substr($paragraph, 0, 1000), 'confidence' => self::LABELLED] : null;
            }
        }

        return null;
    }

    /* ------------------------------------------------------------ bookkeeping */

    /** Arabic-Indic digits as Latin ones; tidy spacing; lines kept. */
    private function normalise(string $text): string
    {
        $text = strtr($text, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);

        return preg_replace('/[ \t\x{00A0}]+/u', ' ', $text);
    }

    /** @return list<string> the non-empty lines, trimmed */
    private function lines(string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\R/', $text)), fn ($line) => $line !== ''));
    }

    private function put(array &$fields, string $key, array|string|null $found, int $confidence = self::LABELLED): void
    {
        if ($found === null || $found === '' || $found === []) {
            return;
        }
        $fields[$key] = is_array($found) ? $found : ['value' => $found, 'confidence' => $confidence];
    }

    /** The MRZ's values over the printed ones where the MRZ is the surer. */
    private function overlay(array $fields, array $mrz): array
    {
        foreach ($mrz as $key => $read) {
            if (! isset($fields[$key]) || $read['confidence'] >= $fields[$key]['confidence']) {
                $fields[$key] = $read;
            }
        }

        return $fields;
    }
}
