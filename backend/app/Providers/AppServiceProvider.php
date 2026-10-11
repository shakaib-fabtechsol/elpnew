<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\Employee;
use App\Models\User;
use App\Services\Circulars\CircularAnalyst;
use App\Services\Invoices\DemoInvoiceReader;
use App\Services\Invoices\InvoiceReader;
use App\Services\Management\InsightWriter;
use App\Services\Permissions\Access;
use App\Services\Permissions\PermissionAdvisor;
use App\Services\Requests\GeminiRequestInterpreter;
use App\Services\Requests\RequestInterpreter;
use App\Services\Requests\RuleBasedRequestInterpreter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The invoice reader is the one piece that becomes real AI later:
        // bind a real implementation here and nothing else changes.
        $this->app->bind(InvoiceReader::class, DemoInvoiceReader::class);

        // The unified request box: read by Gemini when a key is set, by
        // plain rules when it is not - the screens say which was used.
        $this->app->bind(CircularAnalyst::class, fn () => new CircularAnalyst(config('services.gemini.key'), config('services.gemini.model')));
        $this->app->bind(InsightWriter::class, fn () => new InsightWriter(config('services.gemini.key'), config('services.gemini.model')));
        $this->app->bind(PermissionAdvisor::class, fn () => new PermissionAdvisor(config('services.gemini.key'), config('services.gemini.model')));

        $this->app->bind(RequestInterpreter::class, fn () => filled(config('services.gemini.key'))
            ? new GeminiRequestInterpreter(config('services.gemini.key'), config('services.gemini.model'))
            : new RuleBasedRequestInterpreter);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // A misspelt attribute or a lazy-loaded relation in a loop is a bug;
        // say so while developing rather than ship it.
        Model::shouldBeStrict(! $this->app->isProduction());

        $this->registerWorkflowColumns();
        $this->registerGates();
        $this->keepTempDirectoryForServe();
    }

    /**
     * `php artisan serve` starts the web server with only a short list of
     * environment variables, and TEMP / TMP are not on it. On Windows the
     * server then has no temp folder of its own, falls back to C:\Windows,
     * cannot write there - and every file upload fails with "unable to
     * create a temporary file". Passing the two through fixes it.
     */
    private function keepTempDirectoryForServe(): void
    {
        ServeCommand::$passthroughVariables = array_values(array_unique([
            ...ServeCommand::$passthroughVariables, 'TEMP', 'TMP',
        ]));
    }

    /**
     * The columns every money request shares: the decision management took,
     * and the payment the financial department made. One definition, so the
     * stages read the same on a salary advance as on a medical claim.
     */
    private function registerWorkflowColumns(): void
    {
        Blueprint::macro('requestWorkflow', function (): void {
            /** @var Blueprint $this */
            $this->string('status', 20)->default('Pending')->index();

            // Management Decision
            $this->string('decision', 10)->nullable();
            $this->decimal('approved_amount', 12, 3)->nullable();
            $this->text('management_comment')->nullable();
            $this->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $this->timestamp('decided_at')->nullable();

            // Financial Department Actions
            $this->string('expense_type')->nullable();
            $this->string('category')->nullable();
            $this->string('subcategory')->nullable();
            $this->string('payment_method', 40)->nullable();
            $this->string('bank_account')->nullable();
            $this->date('payment_date')->nullable();
            $this->string('payment_reference')->nullable();
            $this->text('finance_comment')->nullable();
            $this->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $this->timestamp('paid_at')->nullable();
        });
    }

    private function registerGates(): void
    {
        // Management: adds and edits employees, decides requests, issues
        // circulars and violations.
        Gate::define('manage', fn (User $user) => $user->role === Role::Admin);

        // Paying and deciding follow System Permissions: by default the
        // financial department pays and management decides, and either can
        // be given to - or taken from - a person there.
        Gate::define('pay', fn (User $user) => Access::allowsOnRequests($user, 'pay'));
        Gate::define('decide', fn (User $user) => Access::allowsOnRequests($user, 'approve'));

        // One named permission: Gate::authorize('permission', 'leaveRequests.approve').
        Gate::define('permission', fn (User $user, string $key) => Access::allows($user, $key));

        // Anyone may see their own record; beyond it, as far as their record
        // access reaches - chosen departments, or everybody.
        Gate::define('view-employee', fn (User $user, Employee $employee) => Access::reaches($user, $employee));
    }
}
