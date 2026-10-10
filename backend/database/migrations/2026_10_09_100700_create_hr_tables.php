<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Leave, violations, general requests, salaries and circulars. */
    public function up(): void
    {
        // Leave: the employee asks, the department reviews, management decides.
        Schema::create('leaves', function (Blueprint $table) {
            $table->id();
            $table->string('leave_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('category', 40)->nullable();
            $table->string('type', 60);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            // The year the days are charged to - next year's, for advance leave.
            $table->unsignedSmallInteger('year');
            // Days paid out rather than taken (leave encashment).
            $table->decimal('days', 6, 2)->nullable();
            $table->string('encashment_no', 20)->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('replacement_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('attachment')->nullable();
            $table->string('status', 20)->default('Pending')->index();
            $table->string('stage', 12)->default('department');
            $table->string('department_decision', 10)->nullable();
            $table->text('department_comment')->nullable();
            $table->foreignId('department_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('department_at')->nullable();
            $table->text('comments')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });

        // Violations: five stages filling one record. Numbered only once a
        // penalty is issued.
        Schema::create('violations', function (Blueprint $table) {
            $table->id();
            $table->string('violation_no', 20)->nullable()->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            // 1. Violation
            $table->string('type', 60);
            $table->date('date');
            $table->text('description');
            $table->string('document')->nullable();
            $table->date('investigation_start')->nullable();
            $table->string('investigator')->nullable();
            // 2. Employee response
            $table->text('response')->nullable();
            $table->string('response_document')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            // 3. Decision
            $table->string('investigation_result', 30)->nullable();
            $table->string('penalty_type', 40)->nullable();
            $table->decimal('deduction_amount', 12, 3)->nullable();
            $table->text('decision_reasons')->nullable();
            $table->string('decision_document')->nullable();
            $table->date('penalty_date')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            // 4. Appeal
            $table->date('appeal_date')->nullable();
            $table->text('appeal_grounds')->nullable();
            $table->string('appeal_document')->nullable();
            // 5. Appeal outcome
            $table->string('appeal_outcome', 60)->nullable();
            $table->text('outcome_reasons')->nullable();
            $table->string('modified_penalty_type', 40)->nullable();
            $table->decimal('modified_deduction_amount', 12, 3)->nullable();
            $table->foreignId('outcome_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('outcome_date')->nullable();
            $table->string('status', 30)->default('Under Investigation')->index();
            $table->timestamps();
        });

        // General requests, grievances and complaints: GR-2026-001.
        Schema::create('general_requests', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 12)->default('general')->index();
            $table->string('request_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('request_type', 60);
            $table->text('comment');
            $table->string('document')->nullable();
            $table->date('date');
            $table->string('status', 10)->default('Pending')->index();
            $table->date('decision_date')->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Monthly salaries: a request (REQ-001) until transferred (SAL-007).
        Schema::create('salary_payments', function (Blueprint $table) {
            $table->id();
            $table->string('request_no', 20)->unique();
            $table->string('salary_no', 20)->nullable()->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('month');
            $table->unsignedSmallInteger('year');
            $table->decimal('basic', 12, 3);
            $table->decimal('allowances', 12, 3)->default(0);
            $table->decimal('loan_deducted', 12, 3)->default(0);
            $table->decimal('advance_deducted', 12, 3)->default(0);
            $table->decimal('administrative', 12, 3)->default(0);
            $table->string('administrative_reason')->nullable();
            $table->string('status', 15)->default('Pending')->index();
            $table->text('rejection_reason')->nullable();
            $table->string('payment_method', 40)->nullable();
            $table->string('bank_account')->nullable();
            $table->string('payment_reference')->nullable();
            $table->date('payment_date')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['employee_id', 'year', 'month']);
        });

        // Circulars: issued to a group, acknowledged one person at a time, and
        // corrected by a new version rather than an edit.
        Schema::create('circulars', function (Blueprint $table) {
            $table->id();
            $table->string('circular_no', 20)->unique();
            $table->string('branch', 20)->default('general');
            $table->date('date');
            $table->string('target_group', 40);
            $table->text('content');
            $table->string('file_name')->nullable();
            $table->string('file_path')->nullable();
            $table->string('status', 12)->default('Active')->index();
            $table->foreignId('supersedes_id')->nullable()->constrained('circulars')->nullOnDelete();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('circular_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('circular_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->timestamp('acknowledged_at');
            $table->unique(['circular_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        foreach (['circular_acknowledgements', 'circulars', 'salary_payments', 'general_requests', 'violations', 'leaves'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
