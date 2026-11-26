<?php

namespace App\Http\Resources;

use App\Models\EmployeeAsset;
use App\Models\Offboarding;
use App\Models\OffboardingTask;
use App\Services\Offboarding\Clearance;
use Illuminate\Http\Request;

/**
 * An End of Service case. In a list: the case, whose it is and how far the
 * checklist has come. Opened (`detailed`): the checklist itself, the assets
 * still out, the settlement and what still blocks completion.
 *
 * The settlement carries pay figures, so it goes only to those who may see
 * salaries - and to the employee, about themselves.
 */
class OffboardingResource extends ApiResource
{
    private bool $detailed = false;

    public function detailed(): static
    {
        $this->detailed = true;

        return $this;
    }

    protected function extra(Request $request): array
    {
        /** @var Offboarding $case */
        $case = $this->resource;
        $employee = $case->employee;
        $tasks = $case->relationLoaded('tasks') ? $case->tasks : collect();
        $required = $tasks->where('required', true);
        $user = $request->user();
        $own = $user && $user->employee_id === $case->employee_id;
        $seesPay = $own || ($user && $user->can('permission', 'payroll.view'));

        $out = [
            'employee' => $employee ? [
                'id' => $employee->id,
                'empNo' => $employee->emp_no,
                'name' => $employee->name,
                'shortName' => $employee->displayName(),
                'department' => $employee->department,
                'occupation' => $employee->occupation,
                'status' => $employee->status,
            ] : null,
            'initiatedByParty' => $case->initiatedByParty(),
            'decisionMaker' => $case->decisionMaker(),
            'initiatedByName' => $case->relationLoaded('initiator') ? $case->initiator?->name : null,
            'decidedByName' => $case->relationLoaded('decider') ? $case->decider?->name : null,
            'completedByName' => $case->relationLoaded('completer') ? $case->completer?->name : null,
            'noticeDaysRemaining' => max(now()->startOfDay()->diffInDays($case->last_working_date, false), 0),
            'progress' => [
                'total' => $tasks->count(),
                'cleared' => $tasks->filter(fn (OffboardingTask $t) => $t->isCleared())->count(),
                'required' => $required->count(),
                'requiredOpen' => $required->filter(fn (OffboardingTask $t) => ! $t->isCleared())->count(),
            ],
            'settlement' => $seesPay ? $case->settlement : null,
        ];

        if (! $this->detailed) {
            return $out;
        }

        $assets = $employee ? EmployeeAsset::where('employee_id', $employee->id)
            ->orderByRaw('case when status = ? then 0 else 1 end', [EmployeeAsset::ASSIGNED])
            ->orderBy('issue_date')->get() : collect();

        return [
            ...$out,
            'tasks' => $tasks->map(fn (OffboardingTask $t) => [
                'id' => $t->id, 'key' => $t->key, 'category' => $t->category,
                'categoryLabel' => Clearance::CATEGORIES[$t->category] ?? $t->category,
                'title' => $t->title, 'owner' => $t->owner, 'required' => $t->required,
                'status' => $t->status, 'notes' => $t->notes,
                'completedAt' => $t->completed_at?->toIso8601String(),
                'completedByName' => $t->relationLoaded('completer') ? $t->completer?->name : null,
            ])->values()->all(),
            'assets' => EmployeeAssetResource::collection($assets)->toArray($request),
            'assetsOutstanding' => $assets->where('status', EmployeeAsset::ASSIGNED)->count(),
            // Frozen once the case closes; worked out afresh until then.
            'settlementEstimate' => $seesPay && $employee ? ($case->settlement ?: Clearance::settlement($case)) : null,
            'blockers' => $case->status === Offboarding::COMPLETED ? [] : Clearance::blockers($case),
            'hasLogin' => $employee ? $employee->user()->exists() : false,
        ];
    }
}
