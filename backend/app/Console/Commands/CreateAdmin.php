<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Creates the administrator who can sign in to a fresh installation - or
 * resets that administrator's password. A new database has no users at all
 * (the deploy only migrates), so this is run once on the server:
 *
 *   php artisan sadeed:create-admin admin@example.com
 *
 * The password is asked for and never shown; it is stored hashed. Passing
 * --password= is there for scripts, but leaves the password in shell history.
 */
class CreateAdmin extends Command
{
    protected $signature = 'sadeed:create-admin
        {email : The address the administrator signs in with}
        {--name= : Their name as shown in the app (default: Administrator)}
        {--password= : The password; asked for when not given}';

    protected $description = 'Create the administrator account, or reset its password';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));
        $password = $this->option('password') ?? $this->secret('Password (at least 12 characters)');

        $check = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['required', 'email'], 'password' => ['required', Password::min(12)]],
        );
        if ($check->fails()) {
            foreach ($check->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        if (! $this->option('password') && $password !== $this->secret('Repeat the password')) {
            $this->error('The two passwords do not match.');

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            // An existing account keeps its name and its employee record.
            $user->forceFill(['password' => $password, 'role' => Role::Admin])->save();
            // Signed out everywhere: the old password no longer opens anything.
            $user->tokens()->delete();
            $this->info("Password reset for {$email} (administrator). Existing sessions were signed out.");

            return self::SUCCESS;
        }

        User::create([
            'name' => $this->option('name') ?: 'Administrator',
            'email' => $email,
            'password' => $password,
            'role' => Role::Admin,
        ]);
        $this->info("Administrator {$email} created. They can sign in now.");

        return self::SUCCESS;
    }
}
