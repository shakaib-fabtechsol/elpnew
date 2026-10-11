<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Circular;
use App\Models\CircularRead;
use App\Models\Employee;
use App\Services\Circulars\CircularAnalyst;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * Circulars, understood and followed up.
 *
 *   POST /circulars/{id}/brief     the AI brief: summary, plain words, key points, actions, deadlines, who it touches
 *   POST /circulars/{id}/ask       an employee's question about the circular, answered from its text
 *   POST /circulars/{id}/read      that the signed-in employee opened it
 *   GET  /circulars-compliance     for management: who has read and acknowledged what, and where it lags
 *
 * A brief is written once and kept with the circular, so every reader sees
 * the same one and the AI is not asked again each time it is opened.
 */
class CircularInsightController extends Controller
{
    public function brief(Request $request, int $id, CircularAnalyst $analyst): JsonResponse
    {
        $circular = $this->visible($request, $id);

        // Written again only by management, and only when asked to.
        $again = $request->boolean('refresh') && $request->user()->can('manage');
        if (! $circular->brief || $again) {
            $brief = $analyst->brief($circular);
            $circular->forceFill(['brief' => $brief, 'brief_engine' => $brief['engine'], 'brief_at' => now()])->save();
        }

        return response()->json(['data' => [...$circular->brief, 'writtenAt' => $circular->brief_at?->toIso8601String()]]);
    }

    public function ask(Request $request, int $id, CircularAnalyst $analyst): JsonResponse
    {
        $circular = $this->visible($request, $id);
        $data = $request->validate(['question' => ['nullable', 'string', 'max:500']]);

        return response()->json(['data' => $analyst->answer($circular->load('issuer:id,name'), $request->user()->employee, $data['question'] ?? null)]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        $circular = $this->visible($request, $id);
        $employee = $request->user()->employee;

        // Only for somebody it was issued to: management browsing is not "read".
        if ($employee && $circular->isFor($employee)) {
            CircularRead::firstOrCreate(['circular_id' => $circular->id, 'employee_id' => $employee->id], ['read_at' => now()]);
        }

        return response()->json(null, 204);
    }

    public function compliance(): JsonResponse
    {
        Gate::authorize('manage');

        $today = CarbonImmutable::today();
        $employees = Employee::where('status', 'Active')->orderBy('name')->get();
        $circulars = Circular::with('acknowledgements:id,circular_id,employee_id,acknowledged_at')->where('status', Circular::ACTIVE)->orderByDesc('date')->orderByDesc('id')->get();
        $reads = CircularRead::whereIn('circular_id', $circulars->pluck('id'))->get()->groupBy('circular_id');

        $perEmployee = [];   // employee id => [pending count, oldest days]
        $perDepartment = []; // department => [targeted, acknowledged]

        $rows = $circulars->map(function (Circular $circular) use ($employees, $reads, $today, &$perEmployee, &$perDepartment) {
            $targeted = $employees->filter(fn (Employee $employee) => $circular->isFor($employee))->values();
            $acknowledged = $circular->acknowledgements->pluck('employee_id')->flip();
            $read = ($reads[$circular->id] ?? collect())->pluck('employee_id')->flip();
            $days = (int) $circular->date->diffInDays($today);

            $pending = [];
            foreach ($targeted as $employee) {
                $department = $employee->department ?: 'Not Set';
                $perDepartment[$department] ??= ['targeted' => 0, 'acknowledged' => 0];
                $perDepartment[$department]['targeted']++;

                if ($acknowledged->has($employee->id)) {
                    $perDepartment[$department]['acknowledged']++;

                    continue;
                }
                $pending[] = ['id' => $employee->id, 'empNo' => $employee->emp_no, 'name' => $employee->displayName(), 'department' => $employee->department, 'read' => $read->has($employee->id)];
                $perEmployee[$employee->id] ??= ['id' => $employee->id, 'empNo' => $employee->emp_no, 'name' => $employee->displayName(), 'department' => $employee->department, 'pending' => 0, 'oldestDays' => 0];
                $perEmployee[$employee->id]['pending']++;
                $perEmployee[$employee->id]['oldestDays'] = max($perEmployee[$employee->id]['oldestDays'], $days);
            }

            $done = $targeted->count() - count($pending);

            return [
                'id' => $circular->id, 'circularNo' => $circular->circular_no, 'date' => $circular->date->toDateString(),
                'targetGroup' => $circular->target_group, 'subject' => mb_strimwidth(trim($circular->content), 0, 110, '…'),
                'targeted' => $targeted->count(), 'acknowledged' => $done,
                'readNotAcknowledged' => count(array_filter($pending, fn ($one) => $one['read'])),
                'unopened' => count(array_filter($pending, fn ($one) => ! $one['read'])),
                'rate' => $targeted->count() ? (int) round($done / $targeted->count() * 100) : 100,
                'daysOpen' => $days,
                'pending' => $pending,
                // Whose daily work the brief says this changes most.
                'mostAffected' => $this->mostAffected($circular, $targeted),
            ];
        })->values();

        $targeted = $rows->sum('targeted');
        $acknowledged = $rows->sum('acknowledged');
        $departments = collect($perDepartment)->map(fn ($counts, $department) => [
            'department' => $department, ...$counts, 'rate' => $counts['targeted'] ? (int) round($counts['acknowledged'] / $counts['targeted'] * 100) : 100,
        ])->sortBy('rate')->values();
        $outstanding = collect($perEmployee)->sortByDesc(fn ($one) => [$one['pending'], $one['oldestDays']])->values();

        return response()->json(['data' => [
            'overall' => [
                'circulars' => $rows->count(), 'targeted' => $targeted, 'acknowledged' => $acknowledged,
                'rate' => $targeted ? (int) round($acknowledged / $targeted * 100) : 100,
                'readNotAcknowledged' => $rows->sum('readNotAcknowledged'), 'unopened' => $rows->sum('unopened'),
            ],
            'circulars' => $rows->all(),
            'departments' => $departments->all(),
            'outstanding' => $outstanding->take(15)->all(),
            'insights' => $this->insights($rows, $departments, $outstanding),
        ]]);
    }

    /* ---------------------------------------------------------- helpers */

    /** A circular the signed-in user may open: management any, others what was issued to them. */
    private function visible(Request $request, int $id): Circular
    {
        $circular = Circular::findOrFail($id);
        $user = $request->user();
        abort_unless($user->can('manage') || ($user->employee && $circular->isFor($user->employee)), 403, 'This circular was not issued to you.');

        return $circular;
    }

    private function mostAffected(Circular $circular, Collection $targeted): array
    {
        $departments = $circular->brief['affectedDepartments'] ?? [];
        $roles = array_map(fn ($role) => mb_strtolower(rtrim($role, 's')), $circular->brief['affectedRoles'] ?? []);
        if (! $departments && ! $roles) {
            return [];
        }

        return $targeted->filter(fn (Employee $employee) => in_array($employee->department, $departments, true)
            || ($employee->occupation && collect($roles)->contains(fn ($role) => $role !== '' && str_contains(mb_strtolower($employee->occupation), $role))))
            ->map(fn (Employee $employee) => ['id' => $employee->id, 'name' => $employee->displayName(), 'department' => $employee->department])
            ->values()->all();
    }

    /** What the figures say, in sentences. Rules over the counts - nothing is guessed. */
    private function insights(Collection $rows, Collection $departments, Collection $outstanding): array
    {
        $lines = [];
        if ($rows->isEmpty()) {
            return ['There are no active circulars to follow up.'];
        }

        $lagging = $rows->filter(fn ($row) => $row['rate'] < 100 && $row['daysOpen'] >= 7)->sortBy('rate')->first();
        if ($lagging) {
            $lines[] = "{$lagging['circularNo']} has been out for {$lagging['daysOpen']} days and stands at {$lagging['rate']}% acknowledged (".($lagging['targeted'] - $lagging['acknowledged'])." of {$lagging['targeted']} still to acknowledge).";
        }

        $weakest = $departments->first(fn ($department) => $department['targeted'] >= 2 && $department['rate'] < 100);
        $strongest = $departments->sortByDesc('rate')->first(fn ($department) => $department['targeted'] >= 2);
        if ($weakest && $strongest && $weakest['department'] !== $strongest['department']) {
            $lines[] = "{$weakest['department']} acknowledges least ({$weakest['rate']}%), {$strongest['department']} most ({$strongest['rate']}%).";
        }

        $repeat = $outstanding->filter(fn ($one) => $one['pending'] >= 2);
        if ($repeat->isNotEmpty()) {
            $lines[] = $repeat->count().' employee'.($repeat->count() === 1 ? ' has' : 's have').' two or more circulars still to acknowledge: '.$repeat->take(4)->pluck('name')->implode(', ').($repeat->count() > 4 ? ' and others' : '').'.';
        }

        $opened = $rows->sum('readNotAcknowledged');
        $unopened = $rows->sum('unopened');
        if ($opened + $unopened > 0) {
            $lines[] = $unopened > $opened
                ? "Most of what is outstanding ({$unopened} of ".($opened + $unopened).') has not been opened at all: a reminder will do more than an explanation.'
                : "{$opened} of ".($opened + $unopened).' outstanding acknowledgements are from people who opened the circular but did not acknowledge it: it may be unclear to them.';
        }

        $all = $rows->every(fn ($row) => $row['rate'] === 100);

        return $all ? ['Every active circular has been acknowledged by everyone it was issued to.'] : $lines;
    }
}
