<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fixture_id
 * @property int $player_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Fixture $fixture
 * @property-read Player $player
 */
#[Fillable(['fixture_id', 'player_id'])]
class Selection extends Model
{
    /**
     * @return BelongsTo<Fixture, $this>
     */
    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }

    /**
     * @return BelongsTo<Player, $this>
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }
}
