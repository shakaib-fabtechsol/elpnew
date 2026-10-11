<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Circulars, read and understood: the brief written for each circular (its
 * summary, key points, required actions, deadlines and who it touches), and
 * who has opened it - which is not the same as having acknowledged it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('circulars', function (Blueprint $table) {
            $table->json('brief')->nullable();
            $table->string('brief_engine', 10)->nullable();   // gemini | rules
            $table->timestamp('brief_at')->nullable();
        });

        Schema::create('circular_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('circular_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->timestamp('read_at');
            $table->unique(['circular_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('circular_reads');
        Schema::table('circulars', function (Blueprint $table) {
            $table->dropColumn(['brief', 'brief_engine', 'brief_at']);
        });
    }
};
