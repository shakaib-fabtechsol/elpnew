<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Employee Offboarding - the End of Service process, kept apart from the
     * everyday requests.
     *
     * One case per departure: who is leaving, why (resignation, termination,
     * end of contract, retirement), the notice served, the approval, the
     * clearance checklist, the exit interview and the final settlement. A
     * case is never deleted: a cancelled or rejected one stays as history.
     */
    public function up(): void
    {
        Schema::create('offboardings', function (Blueprint $table) {
            $table->id();
            $table->string('case_no', 20)->unique();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);                 // Resignation | Termination | End of Contract | Retirement
            $table->string('reason', 80)->nullable();   // the category, from the leaving reasons
            $table->text('details')->nullable();        // what happened, in words
            $table->date('notice_date');                // when notice was given
            $table->unsignedSmallInteger('notice_days')->default(30);
            $table->string('notice_mode', 16)->default('Served'); // Served | Waived | Paid in lieu
            $table->date('last_working_date');
            $table->string('status', 20)->default('Pending Approval');
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('decision_comment')->nullable();
            $table->json('exit_interview')->nullable();
            $table->json('settlement')->nullable();     // the figures frozen at completion
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'status']);
        });

        Schema::create('offboarding_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offboarding_id')->constrained()->cascadeOnDelete();
            $table->string('key', 40);
            $table->string('category', 20);             // handover | access | finance | hr
            $table->string('title', 160);
            $table->string('owner', 40);                // who does it: HR, IT, Finance, Line Manager
            $table->boolean('required')->default(true);
            $table->string('status', 16)->default('Pending'); // Pending | Done | Not Applicable
            $table->text('notes')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['offboarding_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offboarding_tasks');
        Schema::dropIfExists('offboardings');
    }
};
