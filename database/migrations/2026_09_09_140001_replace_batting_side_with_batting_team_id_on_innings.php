<?php

use App\Models\Innings;
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
        Schema::table('fixtures', function (Blueprint $table) {
            $table->foreignId('first_innings_team_id')
                ->nullable()
                ->after('status')
                ->constrained('teams')
                ->nullOnDelete();
        });

        Schema::table('innings', function (Blueprint $table) {
            $table->foreignId('batting_team_id')
                ->nullable()
                ->after('fixture_id')
                ->constrained('teams')
                ->nullOnDelete();
        });

        Innings::query()
            ->with('fixture.season')
            ->each(function (Innings $innings): void {
                $updates = [];

                if ($innings->batting_side === 'us') {
                    $updates['batting_team_id'] = $innings->fixture->season->team_id;
                }

                if ($innings->sequence === 1) {
                    $innings->fixture->update([
                        'first_innings_team_id' => $innings->batting_side === 'us'
                            ? $innings->fixture->season->team_id
                            : null,
                    ]);
                }

                if ($updates !== []) {
                    $innings->update($updates);
                }
            });

        Schema::table('innings', function (Blueprint $table) {
            $table->dropColumn('batting_side');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('innings', function (Blueprint $table) {
            $table->string('batting_side')->nullable()->after('fixture_id');
        });

        Innings::query()
            ->with('fixture.season')
            ->each(function (Innings $innings): void {
                $innings->update([
                    'batting_side' => $innings->batting_team_id === $innings->fixture->season->team_id
                        ? 'us'
                        : 'them',
                ]);
            });

        Schema::table('innings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batting_team_id');
        });

        Schema::table('fixtures', function (Blueprint $table) {
            $table->dropConstrainedForeignId('first_innings_team_id');
        });
    }
};
