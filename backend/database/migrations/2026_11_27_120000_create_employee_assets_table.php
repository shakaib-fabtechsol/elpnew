<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Equipment issued to an employee: a car, a laptop, a phone, a work ID.
     *
     * A row is never deleted. Returning or disposing of an item stamps its
     * date and changes its status, so the register keeps the whole history -
     * and End of Service can check that nothing is still Assigned.
     */
    public function up(): void
    {
        Schema::create('employee_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40);
            $table->string('asset_number', 40);
            $table->string('make_model', 120)->nullable();
            $table->string('serial_number', 80)->nullable();
            $table->date('issue_date');
            $table->date('return_date')->nullable();
            $table->date('disposal_date')->nullable();
            $table->string('status', 10)->default('Assigned');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['employee_id', 'status']);
            $table->index(['asset_number', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_assets');
    }
};
