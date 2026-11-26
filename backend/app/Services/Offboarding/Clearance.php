<?php

namespace App\Services\Offboarding;

use App\Enums\RequestStatus;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Models\EmployeePermission;
use App\Models\Loan;
use App\Models\Offboarding;
use App\Models\OffboardingTask;
use App\Models\PermissionDelegation;
use App\Models\PermissionEvent;
use App\Models\SalaryAdvance;
use App\Models\User;
use App\Services\LeaveBalance;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * What an End of Service case has to clear before it can close, and what
 * closing it does.
 *
 * The checklist follows the usual practice of the large HR platforms: the
 * work handed over, the access taken away, the money squared and the
 * paperwork issued - each with an owner. Assets are not ticked by hand: they
 * are read off the Assigned Assets register, so a case cannot close while
 * the register still shows an item Assigned.
 */
final class Clearance
{
    /** key => [category, title, owner, required] - in the order they are worked through. */
    public const CHECKLIST = [
        'handover_cases' => ['handover', 'Hand over active cases, court files and deadlines', 'Line Manager', true],
        'handover_clients' => ['handover', 'Reassign client relationships and introduce the successor', 'Line Manager', true],
        'handover_documents' => ['handover', 'Return firm documents, files and physical keys', 'HR', true],
        'knowledge_transfer' => ['handover', 'File knowledge-transfer notes for open matters', 'Line Manager', false],
        'access_email' => ['access', 'Disable email and set mailbox forwarding / auto-reply', 'IT', true],
        'access_external' => ['access', 'Remove access to court portals, e-filing and shared drives', 'IT', true],
        'access_building' => ['access', 'Collect building access card and office keys', 'Administration', true],
        'finance_loans' => ['finance', 'Settle outstanding loans and salary advances', 'Finance', true],
        'finance_claims' => ['finance', 'Clear pending expense claims and petty cash', 'Finance', true],
        'finance_settlement' => ['finance', 'Final settlement reviewed and approved for payment', 'Finance', true],
        'hr_certificate' => ['hr', 'Issue experience / service certificate', 'HR', true],
        'hr_authorities' => ['hr', 'Notify Ministry of Labour / Social Protection Fund; cancel visa or work permit where applicable', 'HR', true],
    ];

    public const CATEGORIES = [
        'handover' => 'Handover of Work',
        'access' => 'IT & System Access',
        'finance' => 'Finance Clearance',
        'hr' => 'HR & Documents',
    ];

    /** Opens the checklist on a new case. */
    public static function seed(Offboarding $case): void
    {
        $sort = 0;
        foreach (self::CHECKLIST as $key => [$category, $title, $owner, $required]) {
            $case->tasks()->create(compact('key', 'category', 'title', 'owner', 'required') + ['sort' => ++$sort, 'status' => OffboardingTask::PENDING]);
        }
    }

    /** Items still with the employee. */
    public static function outstandingAssets(Employee $employee)
    {
        return EmployeeAsset::where('employee_id', $employee->id)->outstanding()->orderBy('issue_date')->get();
    }

    /** Loans paid out and not yet repaid. */
    public static function outstandingLoans(Employee $employee): array
    {
        return Loan::with('payments')->where('employee_id', $employee->id)->get()
            ->filter(fn (Loan $loan) => $loan->isOwed())
            ->map(fn (Loan $loan) => ['requestNo' => $loan->request_no, 'amount' => $loan->remaining()])
            ->values()->all();
    }

    /** Advances paid out whose deduction month has not come round yet. */
    public static function outstandingAdvances(Employee $employee): array
    {
        $now = (int) now()->format('Y') * 12 + (int) now()->format('n') - 1;

        return SalaryAdvance::where('employee_id', $employee->id)->where('status', RequestStatus::Paid->value)->get()
            ->filter(fn (SalaryAdvance $advance) => $advance->deductionIndex() >= $now)
            ->map(fn (SalaryAdvance $advance) => [
                'requestNo' => $advance->request_no,
                'amount' => round((float) ($advance->approved_amount ?: $advance->amount), 3),
                'deductMonth' => $advance->deduct_month.' '.$advance->deduct_year,
            ])
            ->values()->all();
    }

    /**
     * The final settlement, worked out from the record - an estimate for
     * Finance to confirm, never a figure typed by hand.
     *
     *   Gratuity        one month's basic pay per year of service, pro rata,
     *                   for non-Omani staff (Omani staff are covered by the
     *                   Social Protection Fund, which pays theirs)
     *   Notice pay      when the notice is paid in lieu: the unserved days at
     *                   the daily gross rate
     *   Leave           this year's unused annual leave at the daily basic rate
     *   Deductions      loans and salary advances still owed
     */
    public static function settlement(Offboarding $case): array
    {
        $employee = $case->employee;
        $basic = (float) $employee->salary;
        $gross = $employee->grossSalary();
        $end = CarbonImmutable::parse($case->last_working_date);
        $joined = $employee->date_of_joining ? CarbonImmutable::parse($employee->date_of_joining) : $end;
        $serviceDays = max($joined->diffInDays($end, false), 0);
        $years = round($serviceDays / 365, 2);

        $omani = strcasecmp((string) $employee->nationality, 'Omani') === 0;
        $gratuity = $omani ? 0.0 : round($basic * $serviceDays / 365, 3);

        $servedDays = max(CarbonImmutable::parse($case->notice_date)->diffInDays($end, false), 0);
        $unserved = max($case->notice_days - $servedDays, 0);
        $noticePay = $case->notice_mode === 'Paid in lieu' ? round($gross / 30 * $unserved, 3) : 0.0;

        $balance = LeaveBalance::for($employee->id, 'Annual Leave', (int) $end->format('Y'));
        $leaveDays = (int) ($balance['remaining'] ?? 0);
        $leavePay = round($basic / 30 * $leaveDays, 3);

        $loans = self::outstandingLoans($employee);
        $advances = self::outstandingAdvances($employee);
        $deductions = round(array_sum(array_column($loans, 'amount')) + array_sum(array_column($advances, 'amount')), 3);

        $earnings = round($gratuity + $noticePay + $leavePay, 3);

        return [
            'basicSalary' => round($basic, 3),
            'grossSalary' => round($gross, 3),
            'serviceYears' => $years,
            'gratuity' => $gratuity,
            'gratuityNote' => $omani
                ? 'Omani staff: paid by the Social Protection Fund, not by the firm.'
                : 'One month\'s basic pay per year of service, pro rata.',
            'noticeDaysUnserved' => $unserved,
            'noticePay' => $noticePay,
            'leaveDays' => $leaveDays,
            'leaveEncashment' => $leavePay,
            'loans' => $loans,
            'advances' => $advances,
            'deductions' => $deductions,
            'earnings' => $earnings,
            'net' => round($earnings - $deductions, 3),
            'estimate' => true,
        ];
    }

    /**
     * What still stands between the case and completion, in words.
     *
     * @return list<string>
     */
    public static function blockers(Offboarding $case): array
    {
        $blockers = [];
        if ($case->status !== Offboarding::IN_PROGRESS) {
            $blockers[] = $case->status === Offboarding::PENDING
                ? 'The case has not been approved yet.'
                : 'The case is '.strtolower($case->status).'.';
        }

        $assets = self::outstandingAssets($case->employee);
        if ($assets->isNotEmpty()) {
            $blockers[] = $assets->count().' assigned asset'.($assets->count() === 1 ? ' is' : 's are').' still with the employee ('.$assets->pluck('type')->join(', ').').';
        }

        $open = $case->tasks->filter(fn (OffboardingTask $task) => $task->required && ! $task->isCleared());
        if ($open->isNotEmpty()) {
            $blockers[] = $open->count().' required checklist item'.($open->count() === 1 ? ' is' : 's are').' still open.';
        }

        return $blockers;
    }

    /**
     * Closes the case: the employee becomes Inactive with the leaving date,
     * whose decision it was and why, and their access to SADEED is taken
     * away. The login account is kept - with its history - but signs in no
     * more: an Inactive employee is refused at sign-in, every device is
     * signed out now, delegated access ends and saved permissions are
     * cleared.
     */
    public static function complete(Offboarding $case, User $by): void
    {
        $blockers = self::blockers($case);
        if ($blockers) {
            throw ValidationException::withMessages(['case' => $blockers]);
        }

        DB::transaction(function () use ($case, $by) {
            $employee = $case->employee;
            $case->forceFill([
                'status' => Offboarding::COMPLETED,
                'settlement' => self::settlement($case),
                'completed_by' => $by->id,
                'completed_at' => now(),
            ])->save();

            $employee->forceFill([
                'status' => 'Inactive',
                'last_working_date' => $case->last_working_date->format('Y-m-d'),
                'decision_maker' => $case->decisionMaker(),
                'reason_for_leaving' => $case->reason ?: $case->type,
                'management_reason' => $case->type === 'Resignation' ? $employee->management_reason : mb_substr($case->type.($case->reason ? ': '.$case->reason : ''), 0, 80),
            ])->save();

            self::revokeAccess($case, $employee, $by);
        });
    }

    /** Takes away everything the person could reach in SADEED. */
    private static function revokeAccess(Offboarding $case, Employee $employee, User $by): void
    {
        $user = $employee->user()->first();
        $user?->tokens()->delete();

        // Delegated to them, and lent by them - neither outlives the job.
        PermissionDelegation::whereNull('revoked_at')
            ->where(fn ($q) => $q->where('employee_id', $employee->id)->orWhere('from_employee_id', $employee->id))
            ->update(['revoked_at' => now(), 'revoked_by' => $by->id]);

        EmployeePermission::updateOrCreate(['employee_id' => $employee->id], [
            'template' => 'staff', 'grants' => [], 'scope' => 'own', 'departments' => [],
            'approval_limit' => null, 'payment_limit' => null, 'updated_by' => $by->id,
        ]);

        PermissionEvent::create([
            'employee_id' => $employee->id, 'user_id' => $by->id, 'action' => 'revoked',
            'summary' => 'Access revoked at end of service ('.$case->case_no.'): signed out of every device, delegations ended, permissions cleared.',
        ]);
    }
}
