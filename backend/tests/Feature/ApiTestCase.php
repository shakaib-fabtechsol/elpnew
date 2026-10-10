<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every API test runs on the demo data, on a fixed day (9 October 2026), so
 * "this month", leave balances and invoice ages read the same on any run.
 */
abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        Carbon::setTestNow('2026-10-09 10:00:00');
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        Carbon::setTestNow();
    }

    /** Signed in as one of the demo users: admin, accounts, aisha, ahmed. */
    protected function as(string $who): static
    {
        $user = User::where('email', $who.'@sadeed.om')->firstOrFail();

        return $this->actingAs($user, 'sanctum');
    }

    protected function api(string $path): string
    {
        return '/api/v1/'.ltrim($path, '/');
    }
}
