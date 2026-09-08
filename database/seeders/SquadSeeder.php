<?php

namespace Database\Seeders;

use App\Models\Player;
use App\Models\Season;
use App\Models\Team;
use Illuminate\Database\Seeder;

class SquadSeeder extends Seeder
{
    /**
     * Seed the squad for Drive to Survive.
     */
    public function run(): void
    {
        $team = Team::firstOrCreate(['name' => 'Drive to Survive']);

        Season::firstOrCreate([
            'team_id' => $team->id,
            'name' => 'GoMammoth - Sep 2026',
        ]);

        $players = [
            ['name' => 'Farhan', 'squad_number' => 7],
            ['name' => 'Zeshan', 'squad_number' => 30],
            ['name' => 'Taabish', 'squad_number' => 23],
            ['name' => 'Blesson', 'squad_number' => 50],
            ['name' => 'Vamsi', 'squad_number' => 51],
            ['name' => 'Shiv', 'squad_number' => 52],
            ['name' => 'Abhishek', 'squad_number' => 53],
            ['name' => 'Daksh', 'squad_number' => 54],
            ['name' => 'Aejaz', 'squad_number' => 55],
            ['name' => 'Shahrukh', 'squad_number' => 56],
            ['name' => 'Shan', 'squad_number' => 57],
            ['name' => 'Will', 'squad_number' => 58],
            ['name' => 'Shaun', 'squad_number' => 59],
            ['name' => 'Shad', 'squad_number' => 60],
        ];

        foreach ($players as $player) {
            Player::firstOrCreate(
                ['team_id' => $team->id, 'name' => $player['name']],
                ['squad_number' => $player['squad_number'], 'active' => true],
            );
        }
    }
}
