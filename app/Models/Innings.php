<?php

namespace App\Models;

use Database\Factories\InningsFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fixture_id
 * @property int|null $batting_team_id
 * @property int $sequence
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Fixture $fixture
 * @property-read Team|null $battingTeam
 * @property-read Collection<int, Delivery> $deliveries
 */
#[Fillable(['fixture_id', 'batting_team_id', 'sequence', 'completed_at'])]
class Innings extends Model
{
    /** @use HasFactory<InningsFactory> */
    use HasFactory;

    protected $table = 'innings';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Fixture, $this>
     */
    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }

    /**
     * @return BelongsTo<Team, $this>
     */
    public function battingTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'batting_team_id');
    }

    /**
     * @return HasMany<Delivery, $this>
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }

    public function isOurs(): bool
    {
        $this->loadMissing('fixture.season');

        return $this->batting_team_id === $this->fixture->season->team_id;
    }
}
