<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A trainee's training period. It is not the contract's term - an intern can
 * be taken on for a few months under no contract at all - so it is kept apart
 * from contract_start_date / employment_end_date rather than squeezed into them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->date('training_start')->nullable()->after('contract_start_date');
            $table->date('training_end')->nullable()->after('training_start');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['training_start', 'training_end']);
        });
    }
};
