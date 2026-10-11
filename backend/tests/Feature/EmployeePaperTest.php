<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/** Document Intake: a new employee's paper read by AI into the fields of the record. */
class EmployeePaperTest extends ApiTestCase
{
    private function paper(): array
    {
        return ['file' => UploadedFile::fake()->create('passport.pdf', 120, 'application/pdf')];
    }

    private function gemini(array $answer, int $status = 200): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($answer)]]]]]], $status)]);
    }

    public function test_with_no_ai_connected_the_screen_is_told_to_use_its_sample(): void
    {
        Http::fake();

        $this->as('admin')->post($this->api('employees/papers/read'), $this->paper(), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.available', false);
        Http::assertNothingSent();
    }

    public function test_a_paper_is_read_into_the_records_fields_and_only_sound_values_are_kept(): void
    {
        $this->gemini([
            'typeKey' => 'passport',
            'fields' => [
                ['key' => 'employeeName', 'value' => 'SALMA KHALFAN SAID AL HARTHY', 'confidence' => 97],
                ['key' => 'dateOfBirth', 'value' => '1994-03-12', 'confidence' => 96],
                ['key' => 'passportExpiry', 'value' => '22 AUG 2028', 'confidence' => 90],   // not a date as asked: dropped
                ['key' => 'gender', 'value' => 'female', 'confidence' => 99],
                ['key' => 'passportNumber', 'value' => 'A12345678', 'confidence' => 188],     // capped at 100
                ['key' => 'salary', 'value' => '1,200', 'confidence' => 80],
                ['key' => 'favouriteColour', 'value' => 'blue', 'confidence' => 99],          // not a field of the record
            ],
            'qualification' => ['degree' => 'LLB', 'specialization' => 'Law', 'institution' => 'SQU', 'year' => '2016'], // not a certificate: ignored
        ]);

        $read = $this->as('admin')->post($this->api('employees/papers/read'), $this->paper(), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.typeKey', 'passport')
            ->assertJsonPath('data.engine', 'gemini')
            ->assertJsonPath('data.fields.gender.value', 'Female')
            ->assertJsonPath('data.fields.passportNumber.confidence', 100)
            ->assertJsonPath('data.fields.salary.value', '1200.000')
            ->assertJsonPath('data.qualification', null)
            ->assertJsonPath('data.duplicateOf', null)
            ->json('data');

        $this->assertSame(['employeeName', 'dateOfBirth', 'gender', 'passportNumber', 'salary'], array_keys($read['fields']));

        // The document itself was sent to be read.
        Http::assertSent(fn ($request) => ($request['contents'][0]['parts'][1]['inlineData']['mimeType'] ?? null) === 'application/pdf');
    }

    public function test_a_failed_reading_is_said_plainly_and_only_those_who_add_employees_may_ask(): void
    {
        $this->gemini([], 429);
        $this->as('admin')->post($this->api('employees/papers/read'), $this->paper(), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', fn ($message) => str_contains($message, 'usage limit'));

        $this->as('ahmed')->post($this->api('employees/papers/read'), $this->paper(), ['Accept' => 'application/json'])->assertForbidden();
        $this->as('admin')->postJson($this->api('employees/papers/read'), [])->assertUnprocessable()->assertJsonValidationErrors('file');
    }
}
