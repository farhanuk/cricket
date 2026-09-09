<?php

namespace App\Models;

use Database\Factories\FixtureFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $season_id
 * @property string $opponent
 * @property Carbon|null $played_at
 * @property string|null $venue
 * @property int $overs
 * @property int $balls_per_over
 * @property string $status
 * @property int|null $first_innings_team_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Season $season
 * @property-read Collection<int, Selection> $selections
 * @property-read Collection<int, Pair> $pairs
 * @property-read Collection<int, Innings> $innings
 */
#[Fillable(['season_id', 'opponent', 'played_at', 'venue', 'overs', 'balls_per_over', 'status', 'first_innings_team_id'])]
class Fixture extends Model
{
    /** @use HasFactory<FixtureFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Season, $this>
     */
    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class);
    }

    /**
     * @return BelongsTo<Team, $this>
     */
    public function firstInningsTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'first_innings_team_id');
    }

    /**
     * @return HasMany<Selection, $this>
     */
    public function selections(): HasMany
    {
        return $this->hasMany(Selection::class);
    }

    /**
     * @return HasMany<Pair, $this>
     */
    public function pairs(): HasMany
    {
        return $this->hasMany(Pair::class);
    }

    /**
     * @return HasMany<Innings, $this>
     */
    public function innings(): HasMany
    {
        return $this->hasMany(Innings::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'played_at' => 'datetime',
        ];
    }
}
