<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The people the firm employs - every field the Employee Information,
     * Employment, Contract, Salary and Social Protection pages ask for.
     *
     * Totals (allowances, deductions, net) are not stored: they are worked out
     * from the components, so a total can never disagree with its parts.
     */
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('emp_no', 12)->unique();

            // Personal
            $table->string('name');
            $table->string('name_ar')->nullable();
            $table->string('nationality', 60)->nullable();
            $table->string('gender', 10)->nullable();
            $table->date('date_of_birth')->nullable();

            // Identity & immigration
            $table->string('civil_id', 40)->nullable();
            $table->date('id_expiry')->nullable();
            $table->string('passport_number', 40)->nullable();
            $table->date('passport_expiry')->nullable();
            $table->string('visa_no', 40)->nullable();
            $table->date('visa_expiry')->nullable();
            $table->string('work_permit_no', 40)->nullable();
            $table->date('work_permit_expiry')->nullable();
            $table->string('lawyer_card_no', 40)->nullable();
            $table->date('lawyer_card_expiry')->nullable();

            // Contact
            $table->string('dial_code', 8)->default('+968');
            $table->string('phone', 30)->nullable();
            $table->string('work_dial_code', 8)->default('+968');
            $table->string('work_phone', 30)->nullable();
            $table->string('work_email')->nullable();
            $table->string('personal_email')->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_name')->nullable();
            $table->string('emergency_relationship', 40)->nullable();
            $table->string('emergency_dial_code', 8)->default('+968');
            $table->string('emergency_phone', 30)->nullable();

            // Employment
            $table->string('status', 10)->default('Active')->index();
            $table->string('branch', 60)->nullable();
            $table->date('date_of_joining')->nullable();
            $table->string('employment_type', 20)->nullable();
            $table->date('employment_end_date')->nullable();
            $table->string('category', 60)->nullable();
            $table->string('job_level', 60)->nullable();
            $table->string('department', 60)->nullable();
            $table->string('occupation', 80)->nullable();
            $table->string('practice_level', 60)->nullable();
            $table->string('position', 80)->nullable();
            $table->string('grade', 40)->nullable();

            // Leaving
            $table->date('last_working_date')->nullable();
            $table->string('decision_maker', 40)->nullable();
            $table->string('reason_for_leaving', 80)->nullable();
            $table->string('management_reason', 80)->nullable();

            // Contract
            $table->string('contract_type', 20)->nullable();
            $table->date('contract_start_date')->nullable();
            $table->string('probation_period', 20)->nullable();
            $table->string('notice_period', 20)->nullable();
            $table->unsignedSmallInteger('annual_leave_days')->default(30);

            // Salary - basic pay, allowances and standing deductions
            $table->decimal('salary', 12, 3)->default(0);
            $table->decimal('special', 12, 3)->default(0);
            $table->decimal('housing', 12, 3)->default(0);
            $table->decimal('phone_allowance', 12, 3)->default(0);
            $table->decimal('transport', 12, 3)->default(0);
            $table->decimal('electricity', 12, 3)->default(0);
            $table->decimal('water', 12, 3)->default(0);
            $table->decimal('loan', 12, 3)->default(0);
            $table->decimal('salary_advance', 12, 3)->default(0);
            $table->decimal('disciplinary', 12, 3)->default(0);
            $table->decimal('other_deduction', 12, 3)->default(0);
            $table->decimal('administrative', 12, 3)->default(0);
            $table->date('salary_effective_date')->nullable();

            // Bank
            $table->string('bank_name', 60)->nullable();
            $table->string('account_holder')->nullable();
            $table->string('account_number', 40)->nullable();
            $table->string('iban', 40)->nullable();
            $table->string('swift_code', 20)->nullable();

            // Social Protection Fund
            $table->boolean('social_protection')->default(true);
            $table->string('sp_registration_no', 40)->nullable();
            $table->date('sp_registration_date')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
