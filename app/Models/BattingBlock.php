<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $innings_id
 * @property int $block_number
 * @property int|null $player_a_id
 * @property int|null $player_b_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Innings $innings
 * @property-read Player|null $playerA
 * @property-read Player|null $playerB
 */
#[Fillable(['innings_id', 'block_number', 'player_a_id', 'player_b_id'])]
class BattingBlock extends Model
{
    /**
     * @return BelongsTo<Innings, $this>
     */
    public function innings(): BelongsTo
    {
        return $this->belongsTo(Innings::class);
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
