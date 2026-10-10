<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every request that ends in money paid to an employee. Each table holds
     * what the employee asks for; `requestWorkflow()` adds the decision and
     * payment columns they all share (see AppServiceProvider).
     */
    public function up(): void
    {
        // Salary Advance: SA-2026-00012, deducted from one named month.
        Schema::create('salary_advances', function (Blueprint $table) {
            $table->id();
            $table->string('request_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('requested_on');
            $table->decimal('amount', 12, 3);
            $table->string('deduct_month', 12);
            $table->unsignedSmallInteger('deduct_year');
            $table->string('purpose', 60);
            $table->string('purpose_other')->nullable();
            $table->text('reason')->nullable();
            $table->requestWorkflow();
            $table->timestamps();
        });

        // Loan: LNR-007, repaid in monthly installments.
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('request_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('requested_on');
            $table->string('kind', 30)->default('New Loan');
            $table->decimal('loan_amount', 12, 3);
            // What was still owed on an earlier loan this one absorbed.
            $table->decimal('merged', 12, 3)->default(0);
            $table->decimal('monthly', 12, 3);
            // A partial approval can change the installment as well as the sum.
            $table->decimal('approved_monthly', 12, 3)->nullable();
            $table->date('first_due')->nullable();
            $table->date('disbursement_date')->nullable();
            $table->string('bank_name', 60)->nullable();
            $table->string('account_number', 40)->nullable();
            $table->text('comment')->nullable();
            $table->string('attachment')->nullable();
            $table->requestWorkflow();
            $table->timestamps();
        });

        // What was actually repaid against a loan's schedule. The schedule
        // itself is worked out from amount, installment and first due date.
        Schema::create('loan_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->date('due_date');
            $table->decimal('amount', 12, 3)->default(0);
            $table->date('paid_on')->nullable();
            $table->boolean('deferred')->default(false);
            $table->string('source', 20)->default('payroll');
            $table->timestamps();
            $table->unique(['loan_id', 'due_date']);
        });

        // Allowances, overtime, leave encashment, notice pay, end of service.
        Schema::create('entitlement_requests', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20)->index();
            $table->string('request_no', 20)->unique();
            // The number it takes once approved: ENT-008.
            $table->string('entitlement_no', 20)->nullable()->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('request_date');
            // Leave encashment
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('leave_type', 60)->nullable();
            $table->decimal('days', 6, 2)->nullable();
            // Overtime
            $table->string('period', 7)->nullable(); // YYYY-MM
            $table->decimal('hours', 6, 2)->nullable();
            // Transport / travel
            $table->string('transport_type', 10)->nullable();
            $table->string('case_file_no', 30)->nullable();
            $table->date('travel_date')->nullable();
            // Money
            $table->decimal('amount', 12, 3);
            $table->decimal('insurance_covered', 12, 3)->default(0);
            $table->text('reason')->nullable();
            $table->string('attachment')->nullable();
            // What the invoice analysis read, and what its checks found.
            $table->json('invoice')->nullable();
            $table->json('risk')->nullable();
            $table->string('invoice_no', 60)->nullable()->index();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->requestWorkflow();
            $table->timestamps();
        });

        // Financial Assistance: ASR-007.
        Schema::create('assistance_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('request_date');
            $table->string('assistance_type', 60);
            $table->string('beneficiary', 40)->default('Employee (Self)');
            $table->string('purpose')->nullable();
            $table->decimal('amount', 12, 3);
            $table->string('proof')->nullable();
            $table->text('notes')->nullable();
            $table->requestWorkflow();
            $table->timestamps();
        });

        // Bonus: BON-012.
        Schema::create('bonuses', function (Blueprint $table) {
            $table->id();
            $table->string('request_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('recorded_on');
            $table->string('bonus_subcategory', 60);
            $table->string('bonus_type')->nullable();
            $table->decimal('amount', 12, 3);
            $table->string('attachment')->nullable();
            $table->text('notes')->nullable();
            $table->requestWorkflow();
            $table->timestamps();
        });

        // Commission arrangements: COM-2026-004.
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->string('commission_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('classification', 40)->nullable();
            $table->string('type', 40);
            $table->string('client_no', 20)->nullable();
            $table->string('client_name')->nullable();
            $table->string('case_file_no', 30)->nullable();
            $table->string('invoice_no', 40)->nullable();
            $table->decimal('rate', 5, 2);
            $table->date('period_from')->nullable();
            $table->date('period_to')->nullable();
            $table->decimal('amount', 12, 3)->nullable();
            $table->string('attachment')->nullable();
            $table->text('notes')->nullable();
            $table->requestWorkflow();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['commissions', 'bonuses', 'assistance_requests', 'entitlement_requests', 'loan_payments', 'loans', 'salary_advances'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
