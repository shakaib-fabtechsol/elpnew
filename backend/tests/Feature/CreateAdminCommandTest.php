<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class CreateAdminCommandTest extends ApiTestCase
{
    public function test_it_creates_an_administrator_who_can_sign_in(): void
    {
        $this->artisan('sadeed:create-admin', ['email' => 'Owner@Firm.om', '--password' => 'a-long-secret-1', '--name' => 'Firm Owner'])
            ->assertSuccessful();

        $user = User::where('email', 'owner@firm.om')->firstOrFail();
        $this->assertSame('admin', $user->role->value);
        $this->assertNotSame('a-long-secret-1', $user->password); // stored hashed

        $this->postJson($this->api('auth/login'), ['email' => 'owner@firm.om', 'password' => 'a-long-secret-1'])
            ->assertOk()
            ->assertJsonPath('data.user.permissions.manage', true);
    }

    public function test_it_resets_the_password_of_an_existing_account_and_signs_it_out(): void
    {
        $admin = User::where('email', 'admin@sadeed.om')->firstOrFail();
        $admin->createToken('old-session');

        $this->artisan('sadeed:create-admin', ['email' => 'admin@sadeed.om', '--password' => 'another-secret-22'])
            ->assertSuccessful();

        $admin->refresh();
        $this->assertTrue(Hash::check('another-secret-22', $admin->password));
        $this->assertSame(1, $admin->employee_id); // still the same employee
        $this->assertSame(0, $admin->tokens()->count());
        $this->postJson($this->api('auth/login'), ['email' => 'admin@sadeed.om', 'password' => 'password'])->assertUnprocessable();
    }

    public function test_it_refuses_a_short_password_or_a_bad_email(): void
    {
        $this->artisan('sadeed:create-admin', ['email' => 'new@firm.om', '--password' => 'short'])->assertFailed();
        $this->artisan('sadeed:create-admin', ['email' => 'not-an-email', '--password' => 'a-long-secret-1'])->assertFailed();
        $this->assertNull(User::where('email', 'new@firm.om')->first());
    }

    public function test_asked_for_twice_when_typed(): void
    {
        $this->artisan('sadeed:create-admin', ['email' => 'typed@firm.om'])
            ->expectsQuestion('Password (at least 12 characters)', 'a-long-secret-1')
            ->expectsQuestion('Repeat the password', 'a-different-one-9')
            ->assertFailed();
    }
}
