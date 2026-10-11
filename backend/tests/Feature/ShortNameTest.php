<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Support\ShortName;

/** The short name: first and family name, kept apart from the full name. */
class ShortNameTest extends ApiTestCase
{
    public function test_first_and_family_name_are_taken_from_the_full_name(): void
    {
        $cases = [
            'Mohammed Abdullah Saeed Al Yahyai' => 'Mohammed Al Yahyai',
            'Mohammed bin Abdullah bin Saeed Al-Yahyai' => 'Mohammed Al-Yahyai',
            'Abdul Rahman Khalid Saif Al Busaidi' => 'Abdul Rahman Al Busaidi',
            'Abd Al Aziz Hamad Al Harthy' => 'Abd Al Aziz Al Harthy',
            'Fatima Salim Abu Bakr' => 'Fatima Abu Bakr',
            'Rajesh Kumar' => 'Rajesh Kumar',
            'Priya' => 'Priya',
            'Jan Pieter van der Berg' => 'Jan van der Berg',
            'محمد عبدالله سعيد اليحيائي' => 'محمد اليحيائي',
            'عبد الله سالم بن حمد آل سعيد' => 'عبد الله آل سعيد',
            '  Sara   Ahmed   Al Lawati ' => 'Sara Al Lawati',
        ];

        foreach ($cases as $full => $short) {
            $this->assertSame($short, ShortName::from($full), $full);
        }
        $this->assertNull(ShortName::from(''));
    }

    public function test_a_new_employee_is_given_a_short_name_and_the_full_name_is_kept(): void
    {
        $this->as('admin')->postJson($this->api('employees'), [
            'employeeName' => 'Mohammed Abdullah Saeed Al Yahyai', 'arabicName' => 'محمد عبدالله سعيد اليحيائي', 'salary' => 900, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Mohammed Abdullah Saeed Al Yahyai')
            ->assertJsonPath('data.shortName', 'Mohammed Al Yahyai')
            // The partner on file is already محمد اليحيائي, so the Arabic one is told apart.
            ->assertJsonPath('data.shortNameAr', 'محمد عبدالله اليحيائي');
    }

    public function test_two_people_who_would_share_one_are_told_apart_by_the_shortest_name_that_does(): void
    {
        $this->as('admin')->postJson($this->api('employees'), ['employeeName' => 'Mohammed Abdullah Saeed Al Yahyai', 'salary' => 900, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer'])->assertCreated();

        // What the form shows while the second is being typed.
        $this->as('admin')->getJson($this->api('employees/short-name').'?name='.urlencode('Mohammed Salim Rashid Al Yahyai'))
            ->assertOk()
            ->assertJsonPath('data.shortName', 'Mohammed Salim Al Yahyai')
            ->assertJsonPath('data.sharedWith.shortName', 'Mohammed Al Yahyai');

        $this->as('admin')->postJson($this->api('employees'), ['employeeName' => 'Mohammed Salim Rashid Al Yahyai', 'salary' => 900, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer'])
            ->assertCreated()->assertJsonPath('data.shortName', 'Mohammed Salim Al Yahyai');

        // Taking the one already in use is refused, with the way out named.
        $this->as('admin')->postJson($this->api('employees'), ['employeeName' => 'Mohammed Hamad Nasser Al Yahyai', 'shortName' => 'mohammed al yahyai', 'salary' => 900, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer'])
            ->assertUnprocessable()->assertJsonValidationErrors('shortName')
            ->assertJsonPath('errors.shortName.0', fn ($message) => str_contains($message, 'Suggested: Mohammed Hamad Al Yahyai.'));
    }

    public function test_a_short_name_set_by_hand_is_kept_when_the_full_name_changes(): void
    {
        $id = $this->as('admin')->postJson($this->api('employees'), ['employeeName' => 'Khalfan Said Nasser Al Mamari', 'shortName' => 'Abu Said Al Mamari', 'salary' => 900, 'dateOfJoining' => '2026-01-05', 'department' => 'Legal Services', 'occupation' => 'Lawyer'])
            ->assertCreated()->assertJsonPath('data.shortName', 'Abu Said Al Mamari')->json('data.id');

        $this->as('admin')->patchJson($this->api('employees/'.$id), ['employeeName' => 'Khalfan Said Nasser Hamed Al Mamari'])
            ->assertOk()->assertJsonPath('data.shortName', 'Abu Said Al Mamari');

        // Cleared on purpose, it is worked out again from the name as it now is.
        $this->as('admin')->patchJson($this->api('employees/'.$id), ['shortName' => null])
            ->assertOk()->assertJsonPath('data.shortName', 'Khalfan Al Mamari');

        // Its own name is not a clash with itself.
        $this->as('admin')->patchJson($this->api('employees/'.$id), ['shortName' => 'Khalfan Al Mamari'])->assertOk();
    }

    public function test_everybody_on_file_has_one_and_no_two_are_the_same(): void
    {
        $names = Employee::pluck('short_name');

        $this->assertCount(25, $names->filter());
        $this->assertCount(25, $names->map(fn ($name) => mb_strtolower($name))->unique());
        $this->assertSame('Abdul Rahman', Employee::where('name', 'Abdul Rahman')->value('short_name'));
    }

    public function test_only_management_may_ask_for_one(): void
    {
        $this->as('ahmed')->getJson($this->api('employees/short-name').'?name=Test+Name')->assertForbidden();
    }
}
