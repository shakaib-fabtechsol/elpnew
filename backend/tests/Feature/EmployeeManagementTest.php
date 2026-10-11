<?php

namespace Tests\Feature;

use App\Models\Violation;
use App\Services\Management\EmployeeSignals;
use Illuminate\Support\Facades\Http;

/** Employee Management: evaluations, the development plan, signals from the records, and the insight. */
class EmployeeManagementTest extends ApiTestCase
{
    private const AHMED = 3;

    private const AISHA = 7;

    private function evaluation(string $period, string $from, string $to, int $score, array $over = []): array
    {
        return [
            'period' => $period, 'periodStart' => $from, 'periodEnd' => $to,
            'scores' => [...array_fill_keys(['quality', 'productivity', 'knowledge', 'communication', 'teamwork', 'reliability', 'initiative'], $score), ...$over],
            'strengths' => 'Careful drafting.', 'improvements' => 'Meeting filing deadlines.', 'goals' => 'Lead two hearings alone.',
        ];
    }

    private function violation(int $employee, string $type, string $date): void
    {
        Violation::create(['employee_id' => $employee, 'type' => $type, 'date' => $date, 'description' => 'Recorded for the test.', 'investigation_result' => 'Guilty', 'penalty_type' => 'Written Warning', 'status' => 'Closed']);
    }

    public function test_an_evaluation_is_recorded_scored_and_rated(): void
    {
        $page = $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 4, ['quality' => 5, 'reliability' => 3]))
            ->assertCreated()
            ->assertJsonPath('data.evaluations.0.period', '2026 H1')
            ->assertJsonPath('data.evaluations.0.overall', 4)
            ->assertJsonPath('data.evaluations.0.rating', 'Exceeds Expectations')
            ->assertJsonPath('data.facts.lastScore', 4)
            ->json('data');

        $this->assertCount(7, $page['criteria']);

        // One evaluation a period; every criterion scored; a period that has ended.
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 3))
            ->assertUnprocessable()->assertJsonValidationErrors('period');
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), [...$this->evaluation('2025 H2', '2025-07-01', '2025-12-31', 3), 'scores' => ['quality' => 6]])
            ->assertUnprocessable()->assertJsonValidationErrors(['scores.quality', 'scores.teamwork']);
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2026 H2', '2026-07-01', '2026-12-31', 3))
            ->assertUnprocessable()->assertJsonValidationErrors('periodEnd');
    }

    public function test_only_those_with_access_to_records_see_it_and_nobody_evaluates_themselves(): void
    {
        $this->as('ahmed')->getJson($this->api('employees/'.self::AISHA.'/management'))->assertForbidden();
        $this->as('ahmed')->getJson($this->api('employees/'.self::AHMED.'/management'))->assertForbidden();
        $this->as('admin')->postJson($this->api('employees/1/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 5))->assertForbidden();
        $this->as('ahmed')->getJson($this->api('employees-standing'))->assertForbidden();
    }

    public function test_the_records_are_read_into_signals_and_a_standing(): void
    {
        // Declining evaluations and the same violation twice.
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2025 H2', '2025-07-01', '2025-12-31', 4))->assertCreated();
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 3, ['reliability' => 2]))->assertCreated();
        $this->violation(self::AHMED, 'Attendance', '2026-05-04');
        $this->violation(self::AHMED, 'Attendance', '2026-08-17');

        $page = $this->as('admin')->getJson($this->api('employees/'.self::AHMED.'/management'))->assertOk()
            ->assertJsonPath('data.standing', EmployeeSignals::ATTENTION)
            ->assertJsonPath('data.facts.scoreTrend', -1.14)
            ->json('data');

        $titles = array_column($page['signals'], 'title');
        $this->assertContains('Performance is declining', $titles);
        $this->assertContains('Weak on Attendance & Reliability', $titles);
        $this->assertContains('Recurring: Attendance', $titles);
        $this->assertGreaterThanOrEqual(2, $page['facts']['violations12m']);

        // A strong evaluation and a clean record.
        $this->as('admin')->postJson($this->api('employees/9/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 5))->assertCreated();
        $strong = $this->as('admin')->getJson($this->api('employees/9/management'))->json('data');
        if ($strong['facts']['violations12m'] === 0) {
            $this->assertSame(EmployeeSignals::HIGH, $strong['standing']);
        }

        // Both show on the firm-wide view.
        $team = $this->as('admin')->getJson($this->api('employees-standing'))->assertOk()->json('data');
        $this->assertContains(self::AHMED, array_column($team['needsAttention'], 'id'));
        $this->assertSame(array_sum($team['counts']), $team['total']);
    }

    public function test_the_development_plan_is_kept_and_followed_up(): void
    {
        $page = $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/development'), [
            'title' => 'Time management workshop', 'kind' => 'Training', 'reason' => 'Missed filing deadlines.', 'dueOn' => '2026-09-30', 'source' => 'ai',
        ])->assertCreated()
            ->assertJsonPath('data.development.0.status', 'Planned')
            ->assertJsonPath('data.development.0.source', 'ai')
            ->assertJsonPath('data.development.0.overdue', true) // due before today (9 October 2026)
            ->json('data');

        $this->assertContains('Development actions overdue', array_column($page['signals'], 'title'));

        $this->as('admin')->patchJson($this->api('employees/'.self::AHMED.'/development/'.$page['development'][0]['id']), ['status' => 'Completed', 'outcome' => 'Attended; deadlines met since.'])
            ->assertOk()
            ->assertJsonPath('data.development.0.status', 'Completed')
            ->assertJsonPath('data.development.0.overdue', false)
            ->assertJsonPath('data.facts.overdueActions', 0);

        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/development'), ['title' => 'x', 'kind' => 'Holiday'])
            ->assertUnprocessable()->assertJsonValidationErrors('kind');
    }

    public function test_without_ai_the_insight_is_compiled_from_the_signals_and_says_so(): void
    {
        Http::fake();
        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/evaluations'), $this->evaluation('2026 H1', '2026-01-01', '2026-06-30', 2))->assertCreated();
        $this->violation(self::AHMED, 'Negligence', '2026-06-02');
        $this->violation(self::AHMED, 'Negligence', '2026-09-01');

        $insight = $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/management/insight'))
            ->assertOk()->assertJsonPath('data.insight.engine', 'rules')->json('data.insight');

        $this->assertStringContainsString('Last evaluated at 2 out of 5', $insight['summary']);
        $this->assertStringContainsString('basic', implode(' ', $insight['notes']).' basic'); // a note is always given
        $this->assertNotEmpty($insight['concerns']);
        $this->assertStringContainsString('Recurring: Negligence', implode(' | ', $insight['patterns']));
        $this->assertContains('Corrective Action', array_column($insight['recommendations'], 'kind'));

        // Kept: opening the page again does not write it again.
        $this->as('admin')->getJson($this->api('employees/'.self::AHMED.'/management'))->assertJsonPath('data.insight.engine', 'rules');
        Http::assertNothingSent();
    }

    public function test_gemini_writes_from_the_signals_and_its_answer_is_held_to_shape(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode([
            'summary' => 'A lawyer whose last evaluation fell and who has two attendance violations.',
            'achievements' => ['Careful drafting noted by the evaluator.'],
            'concerns' => ['Two attendance violations in four months.'],
            'patterns' => ['Attendance violations recur.'],
            'recommendations' => [
                ['title' => 'Attendance improvement plan', 'kind' => 'Corrective Action', 'reason' => 'Two attendance violations.'],
                ['title' => 'Send on holiday', 'kind' => 'Holiday', 'reason' => 'Not a kind the plan knows.'],
            ],
        ])]]]]]])]);
        $this->violation(self::AHMED, 'Attendance', '2026-05-04');
        $this->violation(self::AHMED, 'Attendance', '2026-08-17');

        $this->as('admin')->postJson($this->api('employees/'.self::AHMED.'/management/insight'))
            ->assertOk()
            ->assertJsonPath('data.insight.engine', 'gemini')
            ->assertJsonPath('data.insight.recommendations.0.kind', 'Corrective Action')
            ->assertJsonPath('data.insight.recommendations.1.kind', 'Coaching'); // an unknown kind falls back

        // What the AI was given: the signals worked out from the records, and no name.
        Http::assertSent(function ($request) {
            $sent = $request['contents'][0]['parts'][0]['text'];

            return str_contains($sent, 'Recurring: Attendance') && ! str_contains($sent, 'Ahmed') && $request->hasHeader('x-goog-api-key', 'test-key');
        });
    }
}
