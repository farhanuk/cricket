<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Pair;
use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Pair>
 */
class PairFactory extends Factory
{
    protected $model = Pair::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'fixture_id' => Fixture::factory(),
            'position' => fake()->numberBetween(1, 4),
            'player_a_id' => Player::factory(),
            'player_b_id' => Player::factory(),
        ];
    }
}
