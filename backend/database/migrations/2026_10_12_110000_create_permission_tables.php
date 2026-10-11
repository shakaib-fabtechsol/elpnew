<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * System Permissions: what each employee may see and do.
 *
 * An employee with no row here has the permissions of their job's template;
 * the row appears the first time somebody sets them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('template', 20);                    // the starting point last applied
            $table->json('grants');                            // ["expenses.view", ...]
            $table->string('scope', 12)->default('own');       // own | department | all
            $table->json('departments')->nullable();           // when scope is "department"
            $table->decimal('approval_limit', 12, 3)->nullable(); // per request; null = no ceiling
            $table->decimal('payment_limit', 12, 3)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Access given for a time: covering for a colleague, a project, an audit.
        Schema::create('permission_delegations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            // Whose authority is being lent; empty for a temporary grant by management.
            $table->foreignId('from_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->json('permissions');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('reason', 300);
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['employee_id', 'ends_on']);
        });

        // Who changed what, and when. Written once, never edited.
        Schema::create('permission_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 30);   // updated | delegated | revoked
            $table->string('summary', 300);
            $table->json('changes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['employee_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_events');
        Schema::dropIfExists('permission_delegations');
        Schema::dropIfExists('employee_permissions');
    }
};
