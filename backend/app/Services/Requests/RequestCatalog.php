<?php

namespace App\Services\Requests;

use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\GeneralRequest;
use App\Models\Leave;
use App\Models\SalaryAdvance;

/**
 * Every kind of request an employee can make through the unified request
 * box: what it is called, which fields it needs, and how those fields become
 * the body of the module's own endpoint.
 *
 * The AI only proposes; this catalogue is what decides which fields exist,
 * which are required and which values are allowed - and the request is then
 * created by the module's normal endpoint, so its limits, numbering and
 * approval workflow apply exactly as when the fixed form is used.
 */
final class RequestCatalog
{
    /** type => [label, endpoint, short description for the classifier] */
    public const TYPES = [
        'salaryAdvance' => ['Salary Advance', 'salary-advances', 'An advance on the employee\'s own salary, deducted from one named month.'],
        'loan' => ['Loan', 'loans', 'A loan from the firm repaid in monthly installments over several months.'],
        'assistance' => ['Financial Assistance', 'assistance-requests', 'Help from the firm for a life event: marriage, bereavement, medical treatment of a relative, school fees. Not a claim on an invoice the employee already paid for themselves.'],
        'bonus' => ['Bonus', 'bonuses', 'A bonus request: performance, completing a case, collection, business development, annual, exceptional.'],
        'overtime' => ['Overtime', 'entitlements', 'Pay for extra hours worked in a month.'],
        'leaveEncashment' => ['Leave Encashment', 'entitlements', 'Being paid for unused annual leave days instead of taking them.'],
        'leave' => ['Leave', 'leaves', 'Time off: annual, sick, unpaid, maternity, paternity, marriage, bereavement, hajj, study, patient escort.'],
        'medical' => ['Medical Allowance', 'entitlements', 'Reimbursement of a medical invoice the employee paid (pharmacy, clinic, hospital, dental).'],
        'transport' => ['Transportation Allowance', 'entitlements', 'Reimbursement of local transport costs: fuel, taxi, court visits.'],
        'travel' => ['Travel Allowance', 'entitlements', 'Reimbursement of work travel costs: hotel, meals away.'],
        'airTicket' => ['Air Ticket Allowance', 'entitlements', 'Reimbursement of a flight ticket.'],
        'notice' => ['Notice Pay', 'entitlements', 'Pay in lieu of notice at the end of employment.'],
        'endOfService' => ['End-of-Service Gratuity', 'entitlements', 'The end-of-service settlement.'],
        'general' => ['General Request', 'general-requests', 'An administrative request, a suggestion or a report: a parking card, a chair, equipment.'],
        'grievance' => ['Grievance', 'general-requests', 'A grievance about pay, working conditions, workload or a management decision.'],
        'complaint' => ['Complaint', 'general-requests', 'A complaint about harassment, discrimination, misconduct or health and safety.'],
    ];

    /** Kinds that are made on an invoice: they need the document. */
    public const INVOICE_TYPES = ['medical', 'transport', 'travel', 'airTicket'];

    public static function label(string $type): string
    {
        return self::TYPES[$type][0] ?? $type;
    }

    public static function leaveTypes(): array
    {
        return array_merge(...array_map('array_keys', array_values(Leave::TYPES)));
    }

    /**
     * The fields a type is made of, in the order the review shows them.
     *
     * kind: number | text | longText | date | month (YYYY-MM) | monthName
     *       ("November 2026") | select
     *
     * @return list<array{key:string,label:string,kind:string,required:bool,options?:list<string>}>
     */
    public static function fields(string $type): array
    {
        $year = (int) now()->format('Y');
        $f = fn (string $key, string $label, string $kind, bool $required = true, array $options = []) => [
            'key' => $key, 'label' => $label, 'kind' => $kind, 'required' => $required,
            ...($options ? ['options' => $options] : []),
        ];

        return match ($type) {
            'salaryAdvance' => [
                $f('amount', 'Advance Amount (OMR)', 'number'),
                $f('deductMonth', 'Deduct From Salary Of', 'select', true, SalaryAdvance::MONTHS),
                $f('deductYear', 'Year', 'select', true, [(string) $year, (string) ($year + 1)]),
                $f('purpose', 'Purpose', 'select', true, SalaryAdvance::PURPOSES),
                $f('reason', 'Additional Remarks', 'longText', false),
            ],
            'loan' => [
                $f('amount', 'Requested Loan Amount (OMR)', 'number'),
                $f('monthly', 'Monthly Installment (OMR)', 'number'),
                $f('startMonth', 'Start Deduction From', 'monthName'),
                $f('reason', 'Comment', 'longText', false),
            ],
            'assistance' => [
                $f('assistanceType', 'Assistance Type', 'select', true, array_keys(AssistanceRequest::TYPES)),
                $f('beneficiary', 'Beneficiary', 'select', false, AssistanceRequest::BENEFICIARIES),
                $f('amount', 'Requested Amount (OMR)', 'number'),
                $f('reason', 'Employee Comment', 'longText'),
            ],
            'bonus' => [
                $f('bonusSubcategory', 'Bonus Type', 'select', true, Bonus::SUBCATEGORIES),
                $f('amount', 'Requested Amount (OMR)', 'number'),
                $f('reason', 'Employee Comment', 'longText'),
            ],
            'overtime' => [
                $f('period', 'Period', 'month'),
                $f('hours', 'Overtime Hours', 'number'),
                $f('reason', 'Comment', 'longText', false),
            ],
            'leaveEncashment' => [
                $f('year', 'Year', 'select', true, [(string) $year, (string) ($year - 1)]),
                $f('days', 'Days to Encash', 'number'),
                $f('reason', 'Comment', 'longText', false),
            ],
            'leave' => [
                $f('leaveType', 'Leave Type', 'select', true, self::leaveTypes()),
                $f('fromDate', 'From Date', 'date'),
                $f('toDate', 'To Date', 'date'),
                $f('reason', 'Reason / Notes', 'longText'),
            ],
            'medical', 'transport', 'travel', 'airTicket' => [
                $f('insuranceCovered', 'Amount Covered by Insurance (OMR)', 'number', false),
                $f('reason', 'Comment', 'longText', false),
            ],
            'notice', 'endOfService' => [
                $f('amount', 'Requested Amount (OMR)', 'number'),
                $f('reason', 'Comment', 'longText', false),
            ],
            'general', 'grievance', 'complaint' => [
                $f('requestType', GeneralRequest::KINDS[$type][0].' Type', 'select', true, GeneralRequest::KINDS[$type][2]),
                $f('reason', 'Details', 'longText'),
            ],
            default => [],
        };
    }

    /**
     * What the AI proposed, cut down to the type's own fields with only
     * values this catalogue allows. Anything else is dropped - the AI's
     * word is never taken for what a field may hold.
     */
    public static function clean(string $type, array $proposed): array
    {
        $values = [];
        foreach (self::fields($type) as $field) {
            $raw = $proposed[$field['key']] ?? null;
            $values[$field['key']] = self::coerce($field, $raw);
        }

        return $values;
    }

    private static function coerce(array $field, mixed $raw): mixed
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        switch ($field['kind']) {
            case 'number':
                $number = is_numeric($raw) ? (float) $raw : (float) preg_replace('/[^0-9.]/', '', (string) $raw);

                return $number > 0 ? round($number, 3) : null;

            case 'select':
                foreach ($field['options'] as $option) {
                    if (mb_strtolower(trim((string) $raw)) === mb_strtolower($option)) {
                        return $option;
                    }
                }

                return null;

            case 'date':
                return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $raw) && strtotime((string) $raw) ? (string) $raw : null;

            case 'month':
                return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $raw) ? (string) $raw : null;

            case 'monthName':
                return preg_match('/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/', trim((string) $raw)) ? trim((string) $raw) : null;

            default:
                return mb_substr(trim((string) $raw), 0, 500) ?: null;
        }
    }

    /** The required fields still empty, by key - worked out here, not by the AI. */
    public static function missing(string $type, array $values, bool $hasInvoice): array
    {
        $missing = [];
        foreach (self::fields($type) as $field) {
            if ($field['required'] && ($values[$field['key']] ?? null) === null) {
                $missing[] = $field['key'];
            }
        }
        if (in_array($type, self::INVOICE_TYPES, true) && ! $hasInvoice) {
            $missing[] = 'invoice';
        }

        return $missing;
    }

    /**
     * The body of the module's own endpoint, from the reviewed values.
     *
     * @return array{endpoint:string, body:array<string,mixed>, file:?string}
     *                                                                        `file` names the upload field the attachment goes in, if the endpoint takes one.
     */
    public static function payload(string $type, array $v, ?array $invoice): array
    {
        $endpoint = self::TYPES[$type][1];

        return match ($type) {
            'salaryAdvance' => ['endpoint' => $endpoint, 'file' => null, 'body' => [
                'amount' => $v['amount'], 'deductMonth' => $v['deductMonth'], 'deductYear' => (int) $v['deductYear'],
                'purpose' => $v['purpose'], 'reason' => $v['reason'],
                // "Other" has to say what it is; the remarks are where it was said.
                'purposeOther' => $v['purpose'] === SalaryAdvance::OTHER_PURPOSE ? mb_substr((string) $v['reason'], 0, 120) : null,
            ]],
            'loan' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'loanAmount' => $v['amount'], 'monthly' => $v['monthly'], 'startMonth' => $v['startMonth'], 'comment' => $v['reason'],
            ]],
            'assistance' => ['endpoint' => $endpoint, 'file' => 'proof', 'body' => [
                'assistanceType' => $v['assistanceType'], 'beneficiary' => $v['beneficiary'] ?: 'Employee (Self)',
                'amount' => $v['amount'], 'notes' => $v['reason'],
            ]],
            'bonus' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'bonusSubcategory' => $v['bonusSubcategory'], 'amount' => $v['amount'], 'notes' => $v['reason'],
                'bonusType' => $v['bonusSubcategory'] === Bonus::OTHER ? mb_substr((string) $v['reason'], 0, 120) : null,
            ]],
            'overtime' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'kind' => 'overtime', 'period' => $v['period'], 'hours' => $v['hours'], 'reason' => $v['reason'],
            ]],
            'leaveEncashment' => ['endpoint' => $endpoint, 'file' => null, 'body' => [
                'kind' => 'leaveEncashment', 'year' => (int) $v['year'], 'leaveType' => 'Annual Leave', 'days' => $v['days'], 'reason' => $v['reason'],
            ]],
            'leave' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'type' => $v['leaveType'], 'from' => $v['fromDate'], 'to' => $v['toDate'], 'reason' => $v['reason'],
            ]],
            'medical', 'transport', 'travel', 'airTicket' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'kind' => $type, 'invoice' => $invoice, 'insuranceCovered' => $v['insuranceCovered'] ?? 0,
                'reason' => $v['reason'], 'confirmed' => true,
                ...($type === 'transport' ? ['transportType' => 'general'] : []),
            ]],
            'notice', 'endOfService' => ['endpoint' => $endpoint, 'file' => 'attachment', 'body' => [
                'kind' => $type, 'amount' => $v['amount'], 'reason' => $v['reason'],
            ]],
            'general', 'grievance', 'complaint' => ['endpoint' => $endpoint, 'file' => 'document', 'body' => [
                'kind' => $type, 'requestType' => $v['requestType'], 'comment' => $v['reason'],
            ]],
        };
    }

    /** An invoice as the AI read it, kept only if it is whole and adds up as numbers. */
    public static function cleanInvoice(mixed $invoice): ?array
    {
        if (! is_array($invoice) || blank($invoice['invoiceNo'] ?? null) || blank($invoice['supplierName'] ?? null)) {
            return null;
        }

        $items = [];
        foreach ((array) ($invoice['items'] ?? []) as $item) {
            if (! is_array($item) || blank($item['name'] ?? null) || ! is_numeric($item['amount'] ?? null)) {
                continue;
            }
            $items[] = [
                'name' => mb_substr((string) $item['name'], 0, 255),
                'quantity' => is_numeric($item['quantity'] ?? null) && $item['quantity'] > 0 ? (float) $item['quantity'] : 1,
                'amount' => round((float) $item['amount'], 3),
            ];
        }

        $total = is_numeric($invoice['total'] ?? null) ? round((float) $invoice['total'], 3) : 0;
        if (! $items || $total <= 0) {
            return null;
        }

        $vat = is_numeric($invoice['vat'] ?? null) ? round((float) $invoice['vat'], 3) : 0;
        $date = (string) ($invoice['invoiceDate'] ?? '');

        return [
            'invoiceNo' => mb_substr((string) $invoice['invoiceNo'], 0, 60),
            'invoiceDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && $date <= now()->format('Y-m-d') ? $date : now()->format('Y-m-d'),
            'supplierName' => mb_substr((string) $invoice['supplierName'], 0, 255),
            'supplierVat' => filled($invoice['supplierVat'] ?? null) ? mb_substr((string) $invoice['supplierVat'], 0, 30) : null,
            'purpose' => filled($invoice['purpose'] ?? null) ? mb_substr((string) $invoice['purpose'], 0, 255) : null,
            'items' => $items,
            'subtotal' => is_numeric($invoice['subtotal'] ?? null) ? round((float) $invoice['subtotal'], 3) : round($total - $vat, 3),
            'vat' => $vat,
            'total' => $total,
        ];
    }
}
