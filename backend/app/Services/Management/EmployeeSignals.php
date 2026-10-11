<?php

namespace App\Services\Management;

use App\Models\DevelopmentAction;
use App\Models\Employee;
use App\Models\Leave;
use App\Models\PerformanceEvaluation;
use App\Models\SalaryAdvance;
use App\Models\Violation;
use Carbon\CarbonImmutable;

/**
 * What the records say about one employee, worked out rather than typed:
 * how their evaluations are moving, what violations recur, how their leave
 * falls, what is overdue.
 *
 * Every figure here is read off something the system already holds, so the
 * signals cannot say more than the records do - and they are the facts the
 * AI is given to write from, so it has nothing to invent.
 */
final class EmployeeSignals
{
    public const HIGH = 'High Performer';

    public const ON_TRACK = 'On Track';

    public const ATTENTION = 'Needs Attention';

    public const UNRATED = 'Not Yet Evaluated';

    /**
     * @return array{standing:string,facts:array<string,mixed>,signals:list<array{level:string,area:string,title:string,detail:string}>}
     */
    public static function for(Employee $employee): array
    {
        $today = CarbonImmutable::today();
        $yearAgo = $today->subYear();
        $signals = [];
        $say = function (string $level, string $area, string $title, string $detail) use (&$signals) {
            $signals[] = compact('level', 'area', 'title', 'detail');
        };

        /* ------------------------------------------------ evaluations */
        $evaluations = PerformanceEvaluation::where('employee_id', $employee->id)->where('status', 'Final')->orderBy('period_end')->get();
        $last = $evaluations->last();
        $previous = $evaluations->count() > 1 ? $evaluations[$evaluations->count() - 2] : null;
        $trend = $last && $previous ? round($last->overall - $previous->overall, 2) : null;

        if ($last) {
            $rating = PerformanceEvaluation::rating($last->overall);
            if ($last->overall >= 4.2) {
                $say('positive', 'Performance', 'Strong evaluation', "Rated {$last->overall} out of 5 ({$rating}) for {$last->period}.");
            } elseif ($last->overall < 3) {
                $say('attention', 'Performance', 'Evaluation below expectations', "Rated {$last->overall} out of 5 ({$rating}) for {$last->period}.");
            }
            if ($trend !== null && $trend <= -0.4) {
                $say('attention', 'Performance', 'Performance is declining', "Down {$previous->overall} → {$last->overall} between {$previous->period} and {$last->period}.");
            } elseif ($trend !== null && $trend >= 0.4) {
                $say('positive', 'Performance', 'Performance is improving', "Up {$previous->overall} → {$last->overall} between {$previous->period} and {$last->period}.");
            }

            // The criteria that stand out in the last evaluation.
            $scores = collect($last->scores)->only(array_keys(PerformanceEvaluation::CRITERIA));
            foreach ($scores->filter(fn ($score) => $score <= 2) as $criterion => $score) {
                $say('attention', 'Performance', 'Weak on '.PerformanceEvaluation::CRITERIA[$criterion], "Scored {$score} out of 5 in {$last->period}.");
            }
            if ($last->period_end->lt($today->subMonths(9))) {
                $say('info', 'Performance', 'Evaluation is due', "The last evaluation covers {$last->period}; nothing has been recorded since.");
            }
        } elseif ($employee->date_of_joining && CarbonImmutable::parse($employee->date_of_joining)->lt($today->subMonths(6))) {
            $say('info', 'Performance', 'Never evaluated', 'With the firm for more than six months and no evaluation on record.');
        }

        /* ------------------------------------------------- violations */
        $violations = Violation::where('employee_id', $employee->id)->orderBy('date')->get();
        $recent = $violations->filter(fn (Violation $v) => $v->date && $v->date->gte($yearAgo));
        $upheld = $recent->reject(fn (Violation $v) => $v->investigation_result === 'Not Guilty' || $v->appeal_outcome === Violation::CANCELLING_OUTCOME);
        $byType = $upheld->countBy('type')->sortDesc();
        $recurring = $byType->filter(fn ($count) => $count >= 2);

        foreach ($recurring as $type => $count) {
            $say('attention', 'Conduct', "Recurring: {$type}", "{$count} violations of this kind in the last 12 months.");
        }
        if ($upheld->count() >= 2 && $recurring->isEmpty()) {
            $say('attention', 'Conduct', 'Several violations', $upheld->count().' violations of different kinds in the last 12 months.');
        }
        $severe = $upheld->first(fn (Violation $v) => in_array($v->modified_penalty_type ?: $v->penalty_type, ['Final Warning', 'Suspension from Work'], true));
        if ($severe) {
            $say('attention', 'Conduct', 'Serious penalty on record', ($severe->modified_penalty_type ?: $severe->penalty_type).' on '.$severe->date->format('d/m/Y').' ('.$severe->type.').');
        }
        if ($violations->isNotEmpty() && $recent->isEmpty()) {
            $say('positive', 'Conduct', 'Clean for a year', 'No violations in the last 12 months.');
        }

        /* ------------------------------------------------------ leave */
        $leaves = Leave::where('employee_id', $employee->id)->where('status', 'Approved')->whereNotNull('starts_on')->get()
            ->filter(fn (Leave $l) => $l->starts_on && CarbonImmutable::parse($l->starts_on)->gte($yearAgo));
        $sick = $leaves->where('type', 'Sick Leave');
        $sickDays = $sick->sum(fn (Leave $l) => $l->countedDays());
        // Oman's weekend is Friday and Saturday: a short sick leave that
        // starts on Sunday or ends on Thursday sits against it.
        $besideWeekend = $sick->filter(fn (Leave $l) => $l->countedDays() <= 2
            && (CarbonImmutable::parse($l->starts_on)->isSunday() || CarbonImmutable::parse($l->ends_on ?? $l->starts_on)->isThursday()))->count();
        $unpaidDays = $leaves->where('type', 'Unpaid Leave')->sum(fn (Leave $l) => $l->countedDays());

        if ($sick->count() >= 4) {
            $say('attention', 'Attendance', 'Frequent sick leave', $sick->count()." separate sick leaves ({$sickDays} days) in the last 12 months.");
        }
        if ($besideWeekend >= 3) {
            $say('attention', 'Attendance', 'Short sick leave beside the weekend', "{$besideWeekend} sick leaves of one or two days starting on a Sunday or ending on a Thursday.");
        }
        if ($unpaidDays >= 5) {
            $say('info', 'Attendance', 'Unpaid leave', "{$unpaidDays} days of unpaid leave in the last 12 months.");
        }
        $attendance = $upheld->whereIn('type', ['Attendance', 'Unauthorized Absence'])->count();

        /* ------------------------------------------- money and papers */
        $advances = SalaryAdvance::where('employee_id', $employee->id)->where('created_at', '>=', $today->subMonths(6))->count();
        if ($advances >= 3) {
            $say('info', 'Wellbeing', 'Repeated salary advances', "{$advances} salary advances requested in the last six months - worth a supportive conversation.");
        }

        $expiring = [];
        foreach (['id_expiry' => 'Civil ID', 'passport_expiry' => 'Passport', 'visa_expiry' => 'Visa', 'work_permit_expiry' => 'Work permit', 'lawyer_card_expiry' => 'Lawyer card'] as $column => $label) {
            $date = $employee->getAttributes()[$column] ?? null;
            if ($date && CarbonImmutable::parse($date)->lte($today->addDays(60))) {
                $expiring[] = $label.(CarbonImmutable::parse($date)->lt($today) ? ' expired ' : ' expires ').CarbonImmutable::parse($date)->format('d/m/Y');
            }
        }
        if ($expiring) {
            $say('attention', 'Compliance', 'Documents need renewing', implode('; ', $expiring).'.');
        }

        /* ------------------------------------------------ development */
        $actions = DevelopmentAction::where('employee_id', $employee->id)->get();
        $open = $actions->whereIn('status', DevelopmentAction::OPEN);
        $overdue = $open->filter(fn (DevelopmentAction $a) => $a->due_on && $a->due_on->lt($today));
        $completed = $actions->filter(fn (DevelopmentAction $a) => $a->status === 'Completed' && $a->completed_at?->gte($yearAgo));
        if ($overdue->isNotEmpty()) {
            $say('attention', 'Development', 'Development actions overdue', $overdue->count().' past their due date: '.$overdue->pluck('title')->take(3)->implode('; ').'.');
        }
        if ($completed->count() >= 2) {
            $say('positive', 'Development', 'Following through on development', $completed->count().' development actions completed in the last 12 months.');
        }

        /* --------------------------------------------------- standing */
        $worries = collect($signals)->where('level', 'attention')->whereIn('area', ['Performance', 'Conduct', 'Attendance'])->count();
        $standing = match (true) {
            $worries > 0 && (! $last || $last->overall < 4.2 || $recurring->isNotEmpty() || $severe) => self::ATTENTION,
            $last && $last->overall >= 4.2 && $upheld->isEmpty() => self::HIGH,
            ! $last => $worries > 0 ? self::ATTENTION : self::UNRATED,
            default => self::ON_TRACK,
        };

        $tenure = $employee->date_of_joining ? (int) CarbonImmutable::parse($employee->date_of_joining)->diffInMonths($today) : null;

        return [
            'standing' => $standing,
            'facts' => [
                'tenureMonths' => $tenure,
                'lastScore' => $last?->overall,
                'lastRating' => $last ? PerformanceEvaluation::rating($last->overall) : null,
                'lastPeriod' => $last?->period,
                'scoreTrend' => $trend,
                'evaluations' => $evaluations->map(fn ($e) => ['period' => $e->period, 'overall' => $e->overall])->values()->all(),
                'violations12m' => $upheld->count(),
                'violationsByType' => $byType->all(),
                'attendanceViolations12m' => $attendance,
                'sickLeaves12m' => $sick->count(),
                'sickDays12m' => $sickDays,
                'leaveDays12m' => $leaves->sum(fn (Leave $l) => $l->countedDays()),
                'unpaidDays12m' => $unpaidDays,
                'advances6m' => $advances,
                'openActions' => $open->count(),
                'overdueActions' => $overdue->count(),
                'completedActions12m' => $completed->count(),
            ],
            'signals' => $signals,
        ];
    }
}
