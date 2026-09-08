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
        Schema::create('innings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fixture_id')->constrained()->cascadeOnDelete();
            $table->string('batting_side');
            $table->unsignedTinyInteger('sequence');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('innings');
    }
};
