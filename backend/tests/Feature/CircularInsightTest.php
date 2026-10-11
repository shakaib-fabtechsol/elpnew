<?php

namespace Tests\Feature;

use App\Models\Circular;
use Illuminate\Support\Facades\Http;

/** Circulars understood (the AI brief, questions) and followed up (reads, compliance). */
class CircularInsightTest extends ApiTestCase
{
    private function issue(string $content, string $group = 'All Employees'): int
    {
        return $this->as('admin')->postJson($this->api('circulars'), ['date' => '2026-10-01', 'targetGroup' => $group, 'content' => $content])
            ->assertCreated()->json('data.id');
    }

    private function gemini(array|string $answer): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => is_array($answer) ? json_encode($answer) : $answer]]]]]])]);
    }

    public function test_without_ai_the_brief_is_a_plain_reading_of_the_text_and_says_so(): void
    {
        Http::fake();
        $id = $this->issue('All timesheets must be submitted through SADEED by 25/10/2026. Paper timesheets are no longer accepted. The finance team will run payroll on 28 October.');

        $brief = $this->as('ahmed')->postJson($this->api("circulars/$id/brief"))->assertOk()->assertJsonPath('data.engine', 'rules')->json('data');

        $this->assertSame('All timesheets must be submitted through SADEED by 25/10/2026.', $brief['summary']);
        $this->assertSame('2026-10-25', $brief['actions'][0]['deadline']);
        $this->assertCount(2, $brief['actions']); // "must" and "no longer"
        $this->assertContains('2026-10-28', array_column($brief['deadlines'], 'date'));
        $this->assertStringContainsString('plain reading', $brief['notes'][0]);
        Http::assertNothingSent();
    }

    public function test_gemini_writes_the_brief_once_and_it_is_kept_and_held_to_shape(): void
    {
        $this->gemini([
            'summary' => 'Pleadings are to be filed through the case file.',
            'plainLanguage' => 'From now on, upload every pleading in the case file instead of emailing the court.',
            'keyPoints' => ['File through the case file.', 'Do not email the registry.'],
            'actions' => [['action' => 'File pleadings through the case file', 'who' => 'Lawyers', 'deadline' => 'soon'], ['who' => 'nobody']],
            'deadlines' => [['date' => '2026-11-01', 'label' => 'Email filing stops']],
            'affectedDepartments' => ['Legal Services', 'The Moon'],
            'affectedRoles' => ['Lawyers'],
        ]);
        $id = $this->issue('All pleadings must be filed through the case file, not by direct email to the court registry.', 'Lawyers');

        $this->as('ahmed')->postJson($this->api("circulars/$id/brief"))->assertOk()
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.actions.0.deadline', null)          // "soon" is not a date
            ->assertJsonCount(1, 'data.actions')                        // one with no action is dropped
            ->assertJsonPath('data.affectedDepartments', ['Legal Services']);

        // The next reader gets the same brief; the AI is not asked again.
        $this->as('aisha')->postJson($this->api("circulars/$id/brief"))->assertOk()->assertJsonPath('data.summary', 'Pleadings are to be filed through the case file.');
        Http::assertSentCount(1);
        $this->assertSame('gemini', Circular::find($id)->brief_engine);

        // Somebody it was not issued to cannot open it.
        $this->as('accounts')->postJson($this->api("circulars/$id/brief"))->assertForbidden();
    }

    public function test_a_question_is_answered_from_the_circular_for_the_person_asking(): void
    {
        $this->gemini('As a lawyer you now upload pleadings in the case file; the circular gives no deadline.');
        $id = $this->issue('All pleadings must be filed through the case file.', 'Lawyers');

        $this->as('ahmed')->postJson($this->api("circulars/$id/ask"), ['question' => 'Does this apply to appeals?'])
            ->assertOk()->assertJsonPath('data.engine', 'gemini')->assertJsonPath('data.answer', 'As a lawyer you now upload pleadings in the case file; the circular gives no deadline.');

        Http::assertSent(fn ($request) => str_contains($request['contents'][0]['parts'][0]['text'], 'Does this apply to appeals?')
            && str_contains($request['contents'][0]['parts'][0]['text'], 'The person asking is a Lawyer in Legal Services'));
    }

    public function test_without_ai_a_question_gets_the_circulars_own_words(): void
    {
        Http::fake();
        $id = $this->issue('The office is closed on 18 November.');

        $this->as('ahmed')->postJson($this->api("circulars/$id/ask"))->assertOk()
            ->assertJsonPath('data.engine', 'rules')
            ->assertJsonPath('data.answer', fn ($answer) => str_contains($answer, 'The office is closed on 18 November.'));
    }

    public function test_reading_is_tracked_apart_from_acknowledging_and_compliance_adds_it_up(): void
    {
        Http::fake();
        $id = $this->issue('All pleadings must be filed through the case file.', 'Lawyers');

        $this->as('ahmed')->postJson($this->api("circulars/$id/read"))->assertNoContent();
        $this->as('ahmed')->postJson($this->api("circulars/$id/read"))->assertNoContent(); // once is once
        $this->as('aisha')->postJson($this->api("circulars/$id/acknowledge"))->assertOk();

        $data = $this->as('admin')->getJson($this->api('circulars-compliance'))->assertOk()->json('data');
        $row = collect($data['circulars'])->firstWhere('id', $id);

        $this->assertSame($row['targeted'] - 1, count($row['pending']));
        $this->assertSame(1, $row['acknowledged']);
        $this->assertSame(1, $row['readNotAcknowledged']);
        $this->assertTrue(collect($row['pending'])->firstWhere('name', 'Ahmed Al Balushi')['read']);
        $this->assertNull(collect($row['pending'])->firstWhere('name', 'Aisha Al Kindi'));
        $this->assertSame((int) round(1 / $row['targeted'] * 100), $row['rate']);

        $this->assertSame($data['overall']['targeted'], array_sum(array_column($data['departments'], 'targeted')));
        $this->assertNotEmpty($data['insights']);
        $this->assertNotEmpty($data['outstanding']);

        $this->as('ahmed')->getJson($this->api('circulars-compliance'))->assertForbidden();
    }

    public function test_the_brief_says_whose_work_a_circular_changes_most(): void
    {
        $this->gemini(['summary' => 'x', 'plainLanguage' => 'x', 'keyPoints' => [], 'actions' => [], 'deadlines' => [], 'affectedDepartments' => ['Administration'], 'affectedRoles' => []]);
        $id = $this->issue('Reception hours change to 08:00.');
        $this->as('admin')->postJson($this->api("circulars/$id/brief"))->assertOk();

        $row = collect($this->as('admin')->getJson($this->api('circulars-compliance'))->json('data.circulars'))->firstWhere('id', $id);

        $this->assertNotEmpty($row['mostAffected']);
        $this->assertSame(['Administration'], array_values(array_unique(array_column($row['mostAffected'], 'department'))));
        $this->assertLessThan($row['targeted'], count($row['mostAffected']));
    }
}
