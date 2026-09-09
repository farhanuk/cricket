<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Innings;
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
            'batting_side' => 'us',
            'sequence' => 1,
        ];
    }
}
