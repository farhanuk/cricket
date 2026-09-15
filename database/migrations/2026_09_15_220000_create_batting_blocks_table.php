<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('batting_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('innings_id')->constrained('innings')->cascadeOnDelete();
            $table->unsignedTinyInteger('block_number');
            $table->foreignId('player_a_id')->nullable()->constrained('players')->nullOnDelete();
            $table->foreignId('player_b_id')->nullable()->constrained('players')->nullOnDelete();
            $table->timestamps();

            $table->unique(['innings_id', 'block_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batting_blocks');
    }
};
