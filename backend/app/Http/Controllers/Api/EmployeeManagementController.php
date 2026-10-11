<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DevelopmentAction;
use App\Models\Employee;
use App\Models\EmployeeInsight;
use App\Models\PerformanceEvaluation;
use App\Models\Violation;
use App\Services\Management\EmployeeSignals;
use App\Services\Management\InsightWriter;
use App\Services\Permissions\Access;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Employee Management: how one employee is doing, and what is being done
 * about it.
 *
 *   GET   /employees/{employee}/management               standing, signals, evaluations, plan, last insight
 *   POST  /employees/{employee}/management/insight        write the management insight again (AI)
 *   POST  /employees/{employee}/evaluations               record an evaluation
 *   PUT   /employees/{employee}/evaluations/{evaluation}
 *   POST  /employees/{employee}/development               add a development action
 *   PATCH /employees/{employee}/development/{action}
 *   GET   /employees-standing                             everybody the user's access reaches, by standing
 *
 * For managers and HR: it needs access to employee records, and reaches only
 * as far as that access does. Nobody evaluates themselves.
 */
class EmployeeManagementController extends Controller
{
    public function show(Request $request, Employee $employee): JsonResponse
    {
        $this->mayView($request, $employee);

        return response()->json(['data' => $this->page($employee)]);
    }

    public function insight(Request $request, Employee $employee, InsightWriter $writer): JsonResponse
    {
        $this->mayView($request, $employee);
        $signals = EmployeeSignals::for($employee);

        $content = $writer->write($employee, $signals, [
            'evaluations' => PerformanceEvaluation::where('employee_id', $employee->id)->where('status', 'Final')->orderBy('period_end')->get()
                ->map(fn ($e) => ['period' => $e->period, 'overall' => $e->overall, 'scores' => $this->named($e->scores), 'strengths' => $e->strengths, 'improvements' => $e->improvements, 'goals' => $e->goals])->all(),
            'violations' => Violation::where('employee_id', $employee->id)->orderByDesc('date')->limit(12)->get()
                ->map(fn (Violation $v) => ['date' => $v->date?->toDateString(), 'type' => $v->type, 'result' => $v->investigation_result, 'penalty' => $v->modified_penalty_type ?: $v->penalty_type, 'status' => $v->status])->all(),
            'developmentPlan' => DevelopmentAction::where('employee_id', $employee->id)->latest('id')->limit(15)->get()
                ->map(fn (DevelopmentAction $a) => ['title' => $a->title, 'kind' => $a->kind, 'status' => $a->status, 'dueOn' => $a->due_on?->toDateString(), 'outcome' => $a->outcome])->all(),
        ]);

        EmployeeInsight::updateOrCreate(['employee_id' => $employee->id], [
            'engine' => $content['engine'], 'content' => $content, 'generated_by' => $request->user()->id, 'generated_at' => now(),
        ]);

        return response()->json(['data' => $this->page($employee)]);
    }

    public function storeEvaluation(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $data = $this->evaluationInput($request, $employee);

        PerformanceEvaluation::create([...$data, 'employee_id' => $employee->id, 'evaluator_id' => $request->user()->id]);

        return response()->json(['data' => $this->page($employee)], 201);
    }

    public function updateEvaluation(Request $request, Employee $employee, PerformanceEvaluation $evaluation): JsonResponse
    {
        $this->mayChange($request, $employee);
        abort_unless($evaluation->employee_id === $employee->id, 404);

        $evaluation->update($this->evaluationInput($request, $employee, $evaluation));

        return response()->json(['data' => $this->page($employee)]);
    }

    public function storeAction(Request $request, Employee $employee): JsonResponse
    {
        $this->mayChange($request, $employee);
        $data = $this->actionInput($request);

        DevelopmentAction::create([
            ...$data, 'employee_id' => $employee->id, 'created_by' => $request->user()->id,
            'source' => $request->input('source') === 'ai' ? 'ai' : 'manual',
            'completed_at' => ($data['status'] ?? null) === 'Completed' ? now() : null,
        ]);

        return response()->json(['data' => $this->page($employee)], 201);
    }

    public function updateAction(Request $request, Employee $employee, DevelopmentAction $action): JsonResponse
    {
        $this->mayChange($request, $employee);
        abort_unless($action->employee_id === $employee->id, 404);
        $data = $this->actionInput($request, partial: true);

        if (($data['status'] ?? null) === 'Completed' && $action->status !== 'Completed') {
            $data['completed_at'] = now();
        } elseif (isset($data['status']) && $data['status'] !== 'Completed') {
            $data['completed_at'] = null;
        }
        $action->update($data);

        return response()->json(['data' => $this->page($employee)]);
    }

    /** Everybody the user's access reaches, by standing: who to recognise, who needs attention. */
    public function standing(Request $request): JsonResponse
    {
        Gate::authorize('permission', 'employees.view');

        $rows = Employee::query()
            ->tap(fn (Builder $query) => Access::restrict($query, $request->user(), 'id'))
            ->where('status', 'Active')
            ->orderBy('name')
            ->get()
            ->reject(fn (Employee $employee) => $employee->id === $request->user()->employee_id)
            ->map(function (Employee $employee) {
                $signals = EmployeeSignals::for($employee);
                $attention = array_values(array_filter($signals['signals'], fn ($signal) => $signal['level'] === 'attention'));

                return [
                    'id' => $employee->id, 'empNo' => $employee->emp_no, 'name' => $employee->displayName(),
                    'department' => $employee->department, 'occupation' => $employee->occupation,
                    'standing' => $signals['standing'],
                    'lastScore' => $signals['facts']['lastScore'],
                    'scoreTrend' => $signals['facts']['scoreTrend'],
                    'violations12m' => $signals['facts']['violations12m'],
                    'reasons' => array_slice(array_column($attention ?: array_filter($signals['signals'], fn ($s) => $s['level'] === 'positive'), 'title'), 0, 3),
                ];
            })->values();

        return response()->json(['data' => [
            'counts' => $rows->countBy('standing')->all(),
            'highPerformers' => $rows->where('standing', EmployeeSignals::HIGH)->sortByDesc('lastScore')->values()->all(),
            'needsAttention' => $rows->where('standing', EmployeeSignals::ATTENTION)->values()->all(),
            'notEvaluated' => $rows->where('standing', EmployeeSignals::UNRATED)->count(),
            'total' => $rows->count(),
        ]]);
    }

    /* ---------------------------------------------------------- helpers */

    private function mayView(Request $request, Employee $employee): void
    {
        Gate::authorize('permission', 'employees.view');
        Gate::authorize('view-employee', $employee);
    }

    private function mayChange(Request $request, Employee $employee): void
    {
        $this->mayView($request, $employee);
        Gate::authorize('permission', 'employees.edit');
        abort_if($request->user()->employee_id === $employee->id, 403, 'Nobody evaluates themselves or sets their own development plan.');
    }

    private function evaluationInput(Request $request, Employee $employee, ?PerformanceEvaluation $existing = null): array
    {
        $data = $request->validate([
            'period' => ['required', 'string', 'max:20', Rule::unique('performance_evaluations', 'period')->where('employee_id', $employee->id)->ignore($existing?->id)],
            'periodStart' => ['required', 'date_format:Y-m-d'],
            'periodEnd' => ['required', 'date_format:Y-m-d', 'after:periodStart', 'before_or_equal:today'],
            'scores' => ['required', 'array'],
            ...collect(PerformanceEvaluation::CRITERIA)->mapWithKeys(fn ($label, $key) => ["scores.$key" => ['required', 'integer', 'between:1,5']])->all(),
            'strengths' => ['nullable', 'string', 'max:1000'],
            'improvements' => ['nullable', 'string', 'max:1000'],
            'goals' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', Rule::in(PerformanceEvaluation::STATUSES)],
        ], [
            'period.unique' => 'An evaluation for this period is already on record.',
            'periodEnd.before_or_equal' => 'A period is evaluated once it has ended.',
            'scores.*.required' => 'Score every criterion.',
        ]);

        $scores = collect($data['scores'])->only(array_keys(PerformanceEvaluation::CRITERIA))->map(fn ($score) => (int) $score);

        return [
            'period' => $data['period'], 'period_start' => $data['periodStart'], 'period_end' => $data['periodEnd'],
            'scores' => $scores->all(), 'overall' => round($scores->avg(), 2),
            'strengths' => $data['strengths'] ?? null, 'improvements' => $data['improvements'] ?? null, 'goals' => $data['goals'] ?? null,
            'status' => $data['status'] ?? 'Final',
        ];
    }

    private function actionInput(Request $request, bool $partial = false): array
    {
        $need = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'title' => [$need, 'string', 'max:160'],
            'kind' => [$need, Rule::in(DevelopmentAction::KINDS)],
            'reason' => ['nullable', 'string', 'max:500'],
            'dueOn' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::in(DevelopmentAction::STATUSES)],
            'outcome' => ['nullable', 'string', 'max:500'],
        ]);

        $columns = [];
        foreach (['title' => 'title', 'kind' => 'kind', 'reason' => 'reason', 'dueOn' => 'due_on', 'status' => 'status', 'outcome' => 'outcome'] as $key => $column) {
            if (array_key_exists($key, $data)) {
                $columns[$column] = $data[$key];
            }
        }

        return $columns;
    }

    /** Scores under the names a reader knows them by. */
    private function named(array $scores): array
    {
        return collect(PerformanceEvaluation::CRITERIA)->mapWithKeys(fn ($label, $key) => [$label => $scores[$key] ?? null])->all();
    }

    private function page(Employee $employee): array
    {
        $signals = EmployeeSignals::for($employee);
        $insight = EmployeeInsight::where('employee_id', $employee->id)->first();

        return [
            'standing' => $signals['standing'],
            'facts' => $signals['facts'],
            'signals' => $signals['signals'],
            'criteria' => array_map(fn ($key, $label) => ['key' => $key, 'label' => $label], array_keys(PerformanceEvaluation::CRITERIA), PerformanceEvaluation::CRITERIA),
            'actionKinds' => DevelopmentAction::KINDS,
            'actionStatuses' => DevelopmentAction::STATUSES,
            'evaluations' => PerformanceEvaluation::with('evaluator')->where('employee_id', $employee->id)->orderByDesc('period_end')->get()->map(fn (PerformanceEvaluation $e) => [
                'id' => $e->id, 'period' => $e->period, 'periodStart' => $e->period_start->toDateString(), 'periodEnd' => $e->period_end->toDateString(),
                'scores' => $e->scores, 'overall' => $e->overall, 'rating' => PerformanceEvaluation::rating($e->overall),
                'strengths' => $e->strengths, 'improvements' => $e->improvements, 'goals' => $e->goals,
                'status' => $e->status, 'evaluator' => $e->evaluator?->name, 'recordedOn' => $e->created_at?->toDateString(),
            ])->all(),
            'development' => DevelopmentAction::with('creator')->where('employee_id', $employee->id)->orderByRaw("case status when 'In Progress' then 0 when 'Planned' then 1 when 'Completed' then 2 else 3 end")->orderBy('due_on')->get()->map(fn (DevelopmentAction $a) => [
                'id' => $a->id, 'title' => $a->title, 'kind' => $a->kind, 'reason' => $a->reason, 'dueOn' => $a->due_on?->toDateString(),
                'status' => $a->status, 'outcome' => $a->outcome, 'source' => $a->source, 'createdBy' => $a->creator?->name,
                'overdue' => in_array($a->status, DevelopmentAction::OPEN, true) && $a->due_on && $a->due_on->lt(today()),
            ])->all(),
            'insight' => $insight ? [...$insight->content, 'generatedAt' => $insight->generated_at->toIso8601String()] : null,
        ];
    }
}
