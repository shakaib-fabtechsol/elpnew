<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What the Suppliers page asks for and the directory did not hold yet:
     * the supplier's TIN and the account the firm pays it into.
     */
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('tax_identification_number', 30)->nullable()->after('commercial_registration');
            $table->string('bank', 80)->nullable()->after('tax_identification_number');
            $table->string('account_number', 40)->nullable()->after('bank');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['tax_identification_number', 'bank', 'account_number']);
        });
    }
};
