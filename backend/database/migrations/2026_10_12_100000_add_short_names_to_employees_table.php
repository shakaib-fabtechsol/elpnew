<?php

use App\Support\ShortName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The short name shown across lists, requests and approvals ("Mohammed Al
 * Yahyai"), kept apart from the full name, which stays as it was entered and
 * is what the employee table, payroll and official documents print.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('short_name', 120)->nullable()->after('name');
            $table->string('short_name_ar', 120)->nullable()->after('name_ar');
        });

        // Everybody already on file gets theirs, oldest record first, so the
        // longer-standing employee keeps the plainer name where two clash.
        foreach (DB::table('employees')->orderBy('id')->get(['id', 'name', 'name_ar']) as $employee) {
            DB::table('employees')->where('id', $employee->id)->update([
                'short_name' => ShortName::unique($employee->name, 'short_name', $employee->id),
                'short_name_ar' => ShortName::unique($employee->name_ar, 'short_name_ar', $employee->id),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['short_name', 'short_name_ar']);
        });
    }
};
