<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Innings;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Innings>
 */
class InningsFactory extends Factory
{
    protected $model = Innings::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'fixture_id' => Fixture::factory(),
            'batting_team_id' => Team::factory(),
            'sequence' => 1,
        ];
    }
}
