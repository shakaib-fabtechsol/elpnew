<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;

class AuthTest extends ApiTestCase
{
    public function test_signs_in_and_returns_a_token_with_the_profile(): void
    {
        $response = $this->postJson($this->api('auth/login'), ['email' => 'aisha@sadeed.om', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.user.role', 'lawyer')
            ->assertJsonPath('data.user.employee.empNo', 'EMP-0007')
            ->assertJsonPath('data.user.permissions.manage', false);

        $this->withToken($response->json('data.token'))
            ->getJson($this->api('auth/me'))
            ->assertOk()
            ->assertJsonPath('data.email', 'aisha@sadeed.om');
    }

    public function test_a_wrong_password_is_refused(): void
    {
        $this->postJson($this->api('auth/login'), ['email' => 'aisha@sadeed.om', 'password' => 'nope'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_an_employee_who_has_left_cannot_sign_in(): void
    {
        User::create(['name' => 'Rajesh Kumar', 'email' => 'rajesh@sadeed.om', 'password' => 'password', 'role' => 'accounting', 'employee_id' => Employee::where('emp_no', 'EMP-0005')->value('id')]);

        $this->postJson($this->api('auth/login'), ['email' => 'rajesh@sadeed.om', 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_every_other_route_needs_a_token(): void
    {
        $this->getJson($this->api('employees'))->assertUnauthorized();
        $this->getJson($this->api('salary-advances'))->assertUnauthorized();
    }
}
