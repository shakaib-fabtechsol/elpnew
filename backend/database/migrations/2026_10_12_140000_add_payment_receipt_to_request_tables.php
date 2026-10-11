<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every table with a payment step: the six on `requestWorkflow()` and the
     * monthly salaries, which are transferred the same way.
     */
    private const TABLES = ['salary_advances', 'loans', 'entitlement_requests', 'assistance_requests', 'bonuses', 'commissions', 'salary_payments'];

    /**
     * The transfer receipt the financial department attaches when it pays:
     * where the file is stored, and the name it was uploaded under.
     */
    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->string('payment_receipt')->nullable()->after('payment_reference');
                $table->string('payment_receipt_name')->nullable()->after('payment_receipt');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropColumn(['payment_receipt', 'payment_receipt_name']);
            });
        }
    }
};
