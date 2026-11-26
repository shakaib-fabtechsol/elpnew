<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Personal Information as the redesigned Add Employee asks it: the highest
 * education level, the languages spoken, and the CV as one professional
 * paragraph (written by hand, or by AI from the papers and then edited).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('highest_education', 40)->nullable();
            $table->json('languages')->nullable();
            $table->text('cv_summary')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['highest_education', 'languages', 'cv_summary']);
        });
    }
};
