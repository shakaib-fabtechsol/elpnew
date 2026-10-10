<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Suppliers the firm pays. Created here because an invoice-based claim
     * registers its supplier automatically when the supplier is new.
     */
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_no', 12)->unique();
            $table->string('name');
            $table->string('vat_number', 30)->nullable()->index();
            $table->string('commercial_registration', 30)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('category', 60)->nullable();
            $table->text('address')->nullable();
            $table->string('status', 10)->default('Active');
            // Registered by an invoice analysis rather than by a person.
            $table->boolean('auto_registered')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
