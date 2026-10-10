<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** One row per numbering series (see App\Support\Numbering). */
    public function up(): void
    {
        Schema::create('sequences', function (Blueprint $table) {
            $table->string('series', 40)->primary();
            $table->unsignedInteger('value')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sequences');
    }
};
