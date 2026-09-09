<?php

use App\Models\Fixture;
use App\Models\Innings;
use App\Models\Player;
use App\Models\Season;
use App\Models\Team;
use App\Services\ScoringService;
use App\Services\StatsService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function statsTestService(): StatsService
{
    return app(StatsService::class);
}

function statsScoringService(): ScoringService
{
    return app(ScoringService::class);
}

function createSeasonWithFixtures(): array
{
    $team = Team::factory()->create();
    $season = Season::factory()->for($team)->create();
    $player = Player::factory()->for($team)->create([
        'name' => 'Alex Batter',
        'squad_number' => 7,
    ]);

    $fixtureOne = Fixture::factory()->for($season)->create([
        'overs' => 12,
        'balls_per_over' => 6,
    ]);

    $fixtureTwo = Fixture::factory()->for($season)->create([
        'overs' => 12,
        'balls_per_over' => 6,
    ]);

    return compact('team', 'season', 'player', 'fixtureOne', 'fixtureTwo');
}

function createCompletedFixture(Fixture $fixture, Team $team, int $ourTotal, int $oppTotal): void
{
    $fixture->update(['first_innings_team_id' => $team->id]);

    $ourInnings = Innings::factory()->for($fixture)->create([
        'batting_team_id' => $team->id,
        'sequence' => 1,
    ]);

    $oppInnings = Innings::factory()->for($fixture)->create([
        'batting_team_id' => null,
        'sequence' => 2,
    ]);

    statsScoringService()->record($ourInnings, ['striker_id' => null, 'runs' => $ourTotal]);
    statsScoringService()->record($oppInnings, ['bowler_id' => null, 'runs' => $oppTotal]);

    $ourInnings->update(['completed_at' => now()]);
    $oppInnings->update(['completed_at' => now()]);
}

test('batting card matches net runs including out deductions', function () {
    $team = Team::factory()->create();
    $season = Season::factory()->for($team)->create();
    $fixture = Fixture::factory()->for($season)->create();
    $player = Player::factory()->for($team)->create([
        'name' => 'Alex Batter',
        'squad_number' => 7,
    ]);

    $innings = Innings::factory()->for($fixture)->create([
        'batting_team_id' => $team->id,
        'sequence' => 1,
    ]);

    statsScoringService()->record($innings, ['striker_id' => $player->id, 'runs' => 4]);
    statsScoringService()->record($innings, ['striker_id' => $player->id, 'runs' => 6]);
    statsScoringService()->record($innings, [
        'striker_id' => $player->id,
        'runs' => -5,
        'is_out' => true,
    ]);

    $card = statsTestService()->battingCard($innings);

    expect($card)->toHaveCount(1)
        ->and($card[0]['player'])->toBe('7 Alex Batter')
        ->and($card[0]['runs'])->toBe(5)
        ->and($card[0]['balls'])->toBe(3)
        ->and($card[0]['fours'])->toBe(1)
        ->and($card[0]['sixes'])->toBe(1)
        ->and($card[0]['dismissals'])->toBe(1);
});

test('season batting aggregates runs and balls across fixtures with best single innings', function () {
    [
        'team' => $team,
        'season' => $season,
        'player' => $player,
        'fixtureOne' => $fixtureOne,
        'fixtureTwo' => $fixtureTwo,
    ] = createSeasonWithFixtures();

    $fixtureOne->update(['first_innings_team_id' => $team->id]);

    $inningsOne = Innings::factory()->for($fixtureOne)->create([
        'batting_team_id' => $team->id,
        'sequence' => 1,
    ]);

    Innings::factory()->for($fixtureOne)->create([
        'batting_team_id' => null,
        'sequence' => 2,
    ]);

    statsScoringService()->record($inningsOne, ['striker_id' => $player->id, 'runs' => 4]);
    statsScoringService()->record($inningsOne, ['striker_id' => $player->id, 'runs' => 6]);

    $fixtureTwo->update(['first_innings_team_id' => $team->id]);

    $inningsTwo = Innings::factory()->for($fixtureTwo)->create([
        'batting_team_id' => $team->id,
        'sequence' => 1,
    ]);

    Innings::factory()->for($fixtureTwo)->create([
        'batting_team_id' => null,
        'sequence' => 2,
    ]);

    statsScoringService()->record($inningsTwo, ['striker_id' => $player->id, 'runs' => 3]);
    statsScoringService()->record($inningsTwo, ['striker_id' => $player->id, 'runs' => 2]);
    statsScoringService()->record($inningsTwo, ['striker_id' => $player->id, 'runs' => 1]);

    $batting = statsTestService()->seasonBatting($season);

    expect($batting)->toHaveCount(1)
        ->and($batting[0]['runs'])->toBe(16)
        ->and($batting[0]['balls'])->toBe(5)
        ->and($batting[0]['innings'])->toBe(2)
        ->and($batting[0]['best'])->toBe(10)
        ->and($batting[0]['fours'])->toBe(1)
        ->and($batting[0]['sixes'])->toBe(1);
});

test('team record counts a win and a tie from completed fixtures', function () {
    [
        'team' => $team,
        'season' => $season,
        'fixtureOne' => $fixtureOne,
        'fixtureTwo' => $fixtureTwo,
    ] = createSeasonWithFixtures();

    createCompletedFixture($fixtureOne, $team, 120, 100);
    createCompletedFixture($fixtureTwo, $team, 95, 95);

    expect(statsTestService()->teamRecord($season))->toBe([
        'played' => 2,
        'won' => 1,
        'lost' => 0,
        'tied' => 1,
    ]);
});
