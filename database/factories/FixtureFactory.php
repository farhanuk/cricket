<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Season;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Fixture>
 */
class FixtureFactory extends Factory
{
    protected $model = Fixture::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'season_id' => Season::factory(),
            'opponent' => fake()->company(),
            'played_at' => null,
            'venue' => fake()->city(),
            'overs' => 12,
            'balls_per_over' => 6,
            'status' => 'scheduled',
        ];
    }
}
