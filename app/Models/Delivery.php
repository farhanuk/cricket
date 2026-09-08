<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $innings_id
 * @property int|null $pair_id
 * @property int $over_no
 * @property int|null $ball_no
 * @property int|null $striker_id
 * @property int|null $bowler_id
 * @property int $runs
 * @property bool $is_out
 * @property string|null $extra_type
 * @property bool $counts_toward_over
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Innings $innings
 * @property-read Pair|null $pair
 * @property-read Player|null $striker
 * @property-read Player|null $bowler
 */
#[Fillable([
    'innings_id',
    'pair_id',
    'over_no',
    'ball_no',
    'striker_id',
    'bowler_id',
    'runs',
    'is_out',
    'extra_type',
    'counts_toward_over',
])]
class Delivery extends Model
{
    /**
     * @return BelongsTo<Innings, $this>
     */
    public function innings(): BelongsTo
    {
        return $this->belongsTo(Innings::class);
    }

    /**
     * @return BelongsTo<Pair, $this>
     */
    public function pair(): BelongsTo
    {
        return $this->belongsTo(Pair::class);
    }

    /**
     * @return BelongsTo<Player, $this>
     */
    public function striker(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'striker_id');
    }

    /**
     * @return BelongsTo<Player, $this>
     */
    public function bowler(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'bowler_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'runs' => 'int',
            'is_out' => 'bool',
            'counts_toward_over' => 'bool',
        ];
    }
}
