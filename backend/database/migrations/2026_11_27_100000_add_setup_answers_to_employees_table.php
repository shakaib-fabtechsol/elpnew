<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The answers Add Employee's first step asks before anything else - they
 * decide which papers are asked for and which steps apply:
 *
 *   professional_classification  Lawyer | Non-Lawyer
 *   staff_category               Permanent | Intern / Trainee
 *   paid                         whether the employee draws a salary
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('professional_classification', 20)->nullable()->after('occupation');
            $table->string('staff_category', 30)->nullable()->after('professional_classification');
            $table->boolean('paid')->default(true)->after('staff_category');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['professional_classification', 'staff_category', 'paid']);
        });
    }
};
