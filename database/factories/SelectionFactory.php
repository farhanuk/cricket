<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Player;
use App\Models\Selection;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Selection>
 */
class SelectionFactory extends Factory
{
    protected $model = Selection::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'fixture_id' => Fixture::factory(),
            'player_id' => Player::factory(),
        ];
    }
}
