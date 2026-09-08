<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $fixture_id
 * @property string $batting_side
 * @property int $sequence
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Fixture $fixture
 * @property-read Collection<int, Delivery> $deliveries
 */
#[Fillable(['fixture_id', 'batting_side', 'sequence'])]
class Innings extends Model
{
    protected $table = 'innings';

    /**
     * @return BelongsTo<Fixture, $this>
     */
    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }

    /**
     * @return HasMany<Delivery, $this>
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }
}
