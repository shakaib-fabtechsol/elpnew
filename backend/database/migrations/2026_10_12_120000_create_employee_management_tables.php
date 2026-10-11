<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Employee Management: periodic performance evaluations, the development
 * plan that follows from them, and the last management insight written for
 * each employee.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('period', 20);              // "2026 H1", "2026 Q3", "2026"
            $table->date('period_start');
            $table->date('period_end');
            $table->json('scores');                    // criterion => 1..5
            $table->decimal('overall', 3, 2);          // the mean of the scores
            $table->text('strengths')->nullable();
            $table->text('improvements')->nullable();
            $table->text('goals')->nullable();
            $table->string('status', 10)->default('Final'); // Draft | Final
            $table->foreignId('evaluator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['employee_id', 'period']);
        });

        Schema::create('development_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('kind', 30);                // Training | Coaching | Mentoring | Certification | Corrective Action | Recognition
            $table->text('reason')->nullable();
            $table->date('due_on')->nullable();
            $table->string('status', 15)->default('Planned'); // Planned | In Progress | Completed | Cancelled
            $table->text('outcome')->nullable();
            $table->string('source', 10)->default('manual');  // manual | ai
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'status']);
        });

        Schema::create('employee_insights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('engine', 10);              // gemini | rules
            $table->json('content');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('generated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_insights');
        Schema::dropIfExists('development_actions');
        Schema::dropIfExists('performance_evaluations');
    }
};
