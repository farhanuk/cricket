<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fixture_id
 * @property int $position
 * @property int $player_a_id
 * @property int $player_b_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Fixture $fixture
 * @property-read Player $playerA
 * @property-read Player $playerB
 */
#[Fillable(['fixture_id', 'position', 'player_a_id', 'player_b_id'])]
class Pair extends Model
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
    public function playerA(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'player_a_id');
    }

    /**
     * @return BelongsTo<Player, $this>
     */
    public function playerB(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'player_b_id');
    }
}
