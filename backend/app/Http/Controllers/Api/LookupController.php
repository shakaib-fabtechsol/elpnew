<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workflow\PaymentRequest;
use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\Circular;
use App\Models\Commission;
use App\Models\EmployeeDocument;
use App\Models\EntitlementRequest;
use App\Models\GeneralRequest;
use App\Models\Leave;
use App\Models\Loan;
use App\Models\SalaryAdvance;
use App\Models\Violation;
use Illuminate\Http\JsonResponse;

/**
 * Every fixed list the forms choose from, from the same constants the rules
 * check against - so a choice the screen offers is always one the API takes.
 */
class LookupController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => [
            'departments' => ['Partner', 'Legal Services', 'Administration'],
            'employmentTypes' => ['Full-Time', 'Part-Time', 'Temporary'],
            'contractTypes' => ['Fixed-term', 'Indefinite-term'],
            'practiceLevels' => ['Trainee Lawyer', 'Primary Lawyer', 'Appeal Lawyer', 'Supreme Court Lawyer', 'Non-Practicing Lawyers Register'],
            'paymentMethods' => PaymentRequest::METHODS,
            'months' => SalaryAdvance::MONTHS,
            'salaryAdvance' => ['purposes' => SalaryAdvance::PURPOSES, 'otherPurpose' => SalaryAdvance::OTHER_PURPOSE],
            'loan' => ['kinds' => [Loan::NEW_LOAN, Loan::INCREASE], 'limitMonths' => Loan::LIMIT_MONTHS],
            'assistance' => [
                'types' => array_map(fn ($name, $doc) => ['name' => $name, 'document' => $doc], array_keys(AssistanceRequest::TYPES), AssistanceRequest::TYPES),
                'beneficiaries' => AssistanceRequest::BENEFICIARIES,
                'limitMonths' => AssistanceRequest::LIMIT_MONTHS,
            ],
            'bonus' => ['subcategories' => Bonus::SUBCATEGORIES, 'other' => Bonus::OTHER],
            'commission' => ['types' => [Commission::FIXED, Commission::INVOICE_LINKED], 'classifications' => Commission::CLASSIFICATIONS],
            'entitlements' => [
                'kinds' => array_map(fn ($kind, $def) => ['kind' => $kind, 'prefix' => $def[0], 'subcategory' => $def[1], 'needsInvoice' => EntitlementRequest::needsInvoice($kind)], array_keys(EntitlementRequest::KINDS), EntitlementRequest::KINDS),
                'daysInMonth' => EntitlementRequest::DAYS_IN_MONTH,
                'hoursInDay' => EntitlementRequest::HOURS_IN_DAY,
            ],
            'leave' => [
                'categories' => array_map(fn ($category, $types) => [
                    'name' => $category,
                    'types' => array_map(fn ($type, $ent) => ['name' => $type, 'entitlement' => $ent], array_keys($types), $types),
                ], array_keys(Leave::TYPES), Leave::TYPES),
            ],
            'violations' => [
                'types' => Violation::TYPES,
                'investigationResults' => Violation::INVESTIGATION_RESULTS,
                'penalties' => Violation::PENALTIES,
                'appealOutcomes' => Violation::APPEAL_OUTCOMES,
            ],
            'generalRequests' => array_map(fn ($def) => ['title' => $def[0], 'prefix' => $def[1], 'types' => $def[2]], GeneralRequest::KINDS),
            'documents' => ['types' => EmployeeDocument::allTypes(), 'expiring' => array_keys(EmployeeDocument::RELATED_RECORD), 'expiringDays' => EmployeeDocument::EXPIRING_DAYS],
            'circulars' => ['targetGroups' => Circular::TARGET_GROUPS],
        ]]);
    }
}
