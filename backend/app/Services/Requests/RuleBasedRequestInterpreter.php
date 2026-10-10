<?php

namespace App\Services\Requests;

use App\Models\SalaryAdvance;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;

/**
 * The reading done without AI: used when no Gemini key is configured, or
 * when the AI service cannot be reached. It looks for plain English key
 * words and figures - enough to pick the type and the obvious numbers, and
 * honest about being a fallback (engine "rules"): it does not read documents
 * and does not understand Arabic or Urdu. The employee completes the rest.
 */
class RuleBasedRequestInterpreter implements RequestInterpreter
{
    /** type => words that point to it; first match in this order wins. */
    private const SIGNS = [
        'leaveEncashment' => ['encash', 'cash out my leave', 'paid for unused leave', 'leave salary'],
        'salaryAdvance' => ['salary advance', 'advance on my salary', 'advance salary', 'advance of'],
        'loan' => ['loan', 'installment', 'instalment', 'borrow'],
        'overtime' => ['overtime', 'extra hours', 'worked extra'],
        'complaint' => ['complaint', 'harass', 'discriminat', 'misconduct', 'unsafe'],
        'grievance' => ['grievance', 'unfair', 'workload', 'not been paid', 'not reflected'],
        'assistance' => ['assistance', 'financial help', 'support for', 'funeral', 'bereavement', 'wedding', 'marriage', 'school fees', 'tuition'],
        'bonus' => ['bonus'],
        'airTicket' => ['air ticket', 'flight', 'airfare'],
        'travel' => ['hotel', 'travel allowance', 'business trip'],
        'transport' => ['fuel', 'petrol', 'taxi', 'transport'],
        'medical' => ['medical', 'pharmacy', 'hospital', 'clinic', 'dental', 'prescription', 'medicine'],
        'endOfService' => ['end of service', 'gratuity'],
        'notice' => ['notice pay', 'notice period pay'],
        'leave' => ['leave', 'day off', 'days off', 'vacation', 'holiday', 'time off'],
        'general' => ['request', 'please issue', 'i need', 'suggest'],
    ];

    private const LEAVE_WORDS = [
        'Sick Leave' => ['sick', 'ill', 'surgery', 'medical leave'],
        'Maternity Leave' => ['maternity'],
        'Paternity Leave' => ['paternity', 'new baby', 'newborn'],
        'Marriage Leave' => ['wedding', 'marriage'],
        'Bereavement Leave' => ['bereavement', 'funeral', 'passed away', 'death'],
        'Hajj Leave' => ['hajj', 'pilgrimage'],
        'Study / Examination Leave' => ['exam', 'study'],
        'Unpaid Leave' => ['unpaid'],
        'Annual Leave' => ['annual', 'vacation', 'holiday'],
    ];

    public function interpret(?string $text, ?UploadedFile $file): array
    {
        $plain = mb_strtolower((string) $text);
        $type = null;
        foreach (self::SIGNS as $candidate => $words) {
            foreach ($words as $word) {
                if (str_contains($plain, $word)) {
                    $type = $candidate;
                    break 2;
                }
            }
        }

        $fields = ['reason' => filled($text) ? trim((string) $text) : null];

        if ($type) {
            $fields += $this->figures($type, $plain);
        }

        return [
            'type' => $type,
            'confidence' => $type ? 0.5 : 0.0,
            'summary' => $type
                ? 'This looks like a '.RequestCatalog::label($type).' request. Please check the details below.'
                : 'The request could not be recognised automatically.',
            'fields' => $fields,
            'invoice' => null,
            'engine' => 'rules',
        ];
    }

    private function figures(string $type, string $plain): array
    {
        $out = [];
        $today = CarbonImmutable::today();

        // "500 OMR", "omr 500", "500 rials", or the first plain figure of 2+ digits.
        if (preg_match('/(?:omr|rials?|ro)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:omr|rials?|ro)\b/', $plain, $m)) {
            $out['amount'] = (float) str_replace(',', '', $m[1] ?: $m[2]);
        }

        if (preg_match('/([\d.]+)\s*hours?/', $plain, $m)) {
            $out['hours'] = (float) $m[1];
        }
        if (preg_match('/([\d.]+)\s*days?/', $plain, $m)) {
            $out['days'] = (float) $m[1];
        }
        if (preg_match('/([\d,]+(?:\.\d+)?)\s*(?:omr\s*)?(?:per month|a month|monthly|each month)/', $plain, $m)) {
            $out['monthly'] = (float) str_replace(',', '', $m[1]);
        }

        // A month named in the text.
        foreach (SalaryAdvance::MONTHS as $index => $month) {
            if (str_contains($plain, mb_strtolower($month))) {
                $number = $index + 1;
                $thisMonth = (int) $today->format('n');
                $thisYear = (int) $today->format('Y');
                // A deduction or a repayment looks ahead: a month already
                // gone means next year's. Overtime looks back: a month not
                // reached yet means last year's.
                $ahead = $number < $thisMonth ? $thisYear + 1 : $thisYear;
                $behind = $number > $thisMonth ? $thisYear - 1 : $thisYear;
                $out['deductMonth'] = $month;
                $out['deductYear'] = (string) $ahead;
                $out['startMonth'] = $month.' '.$ahead;
                $out['period'] = sprintf('%04d-%02d', $behind, $number);
                break;
            }
        }
        if (! isset($out['deductMonth']) && str_contains($plain, 'next month')) {
            $next = $today->addMonthNoOverflow();
            $out['deductMonth'] = $next->format('F');
            $out['deductYear'] = $next->format('Y');
            $out['startMonth'] = $next->format('F Y');
        }

        // Explicit dates: 2026-11-01 or 01/11/2026.
        preg_match_all('/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/', $plain, $dates, PREG_SET_ORDER);
        $iso = array_map(fn ($d) => $d[1] ? "{$d[1]}-{$d[2]}-{$d[3]}" : sprintf('%04d-%02d-%02d', $d[6], $d[5], $d[4]), $dates);
        if ($iso) {
            $out['fromDate'] = $iso[0];
            $out['toDate'] = $iso[1] ?? $iso[0];
        }

        if ($type === 'leave') {
            foreach (self::LEAVE_WORDS as $leaveType => $words) {
                foreach ($words as $word) {
                    if (str_contains($plain, $word)) {
                        $out['leaveType'] = $leaveType;
                        break 2;
                    }
                }
            }
        }

        if ($type === 'leaveEncashment') {
            $out['year'] = $today->format('Y');
        }

        return $out;
    }
}
