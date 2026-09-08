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
        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('innings_id')->constrained('innings')->cascadeOnDelete();
            $table->foreignId('pair_id')->nullable()->constrained('pairs')->nullOnDelete();
            $table->unsignedSmallInteger('over_no');
            $table->unsignedTinyInteger('ball_no')->nullable();
            $table->foreignId('striker_id')->nullable()->constrained('players')->nullOnDelete();
            $table->foreignId('bowler_id')->nullable()->constrained('players')->nullOnDelete();
            $table->integer('runs');
            $table->boolean('is_out')->default(false);
            $table->string('extra_type')->nullable();
            $table->boolean('counts_toward_over')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
