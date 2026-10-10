<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The firm's own bank accounts - where payments to employees and
     * suppliers leave from. Every payment form offers the active ones.
     */
    public function up(): void
    {
        Schema::create('firm_bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('bank_name', 80);
            $table->string('logo')->nullable();
            $table->string('bank_branch', 80)->nullable();
            $table->string('branch_area', 80)->nullable();
            $table->string('location', 120)->nullable();
            $table->string('account_name', 120);
            $table->string('account_type', 40)->nullable();
            $table->string('account_number', 40)->unique();
            $table->string('iban', 40)->nullable();
            $table->string('swift', 20)->nullable();
            // The firm branch the account belongs to, when it is one branch's.
            $table->unsignedInteger('branch_id')->nullable();
            $table->decimal('opening_balance', 14, 3)->default(0);
            $table->date('opened_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('firm_bank_accounts');
    }
};
