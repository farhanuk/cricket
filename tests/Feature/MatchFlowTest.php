<?php

use App\Models\Fixture;
use App\Models\Innings;
use App\Models\Pair;
use App\Models\Player;
use App\Models\Season;
use App\Models\Selection;
use App\Models\Team;
use App\Models\User;
use App\Services\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function matchFlowService(): ScoringService
{
    return app(ScoringService::class);
}

function createMatchFixtureSetup(): array
{
    $team = Team::factory()->create();
    $season = Season::factory()->for($team)->create();
    $fixture = Fixture::factory()->for($season)->create([
        'overs' => 12,
        'balls_per_over' => 6,
    ]);

    $players = collect(range(1, 8))->map(
        fn (int $number) => Player::factory()->for($team)->create([
            'name' => "Player {$number}",
            'squad_number' => $number,
        ]),
    );

    foreach ($players as $player) {
        Selection::factory()->for($fixture)->for($player)->create();
    }

    foreach (range(1, 4) as $position) {
        Pair::factory()->for($fixture)->create([
            'position' => $position,
            'player_a_id' => $players[($position - 1) * 2]->id,
            'player_b_id' => $players[($position - 1) * 2 + 1]->id,
        ]);
    }

    return compact('fixture', 'players', 'team');
}

function createBothInnings(Fixture $fixture, Team $team, string $batsFirst): void
{
    if ($batsFirst === 'us') {
        $fixture->update(['first_innings_team_id' => $team->id]);

        Innings::factory()->for($fixture)->create([
            'batting_team_id' => $team->id,
            'sequence' => 1,
        ]);

        Innings::factory()->for($fixture)->create([
            'batting_team_id' => null,
            'sequence' => 2,
        ]);
    } else {
        $fixture->update(['first_innings_team_id' => null]);

        Innings::factory()->for($fixture)->create([
            'batting_team_id' => null,
            'sequence' => 1,
        ]);

        Innings::factory()->for($fixture)->create([
            'batting_team_id' => $team->id,
            'sequence' => 2,
        ]);
    }
}

test('start with bats_first them creates opposition first innings and ours second', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post("/fixtures/{$fixture->id}/score", ['bats_first' => 'them'])
        ->assertRedirect();

    $fixture->refresh();
    $innings = $fixture->innings()->orderBy('sequence')->get();

    expect($fixture->first_innings_team_id)->toBeNull()
        ->and($innings)->toHaveCount(2)
        ->and($innings[0]->sequence)->toBe(1)
        ->and($innings[0]->batting_team_id)->toBeNull()
        ->and($innings[1]->sequence)->toBe(2)
        ->and($innings[1]->batting_team_id)->toBe($team->id);
});

test('start with bats_first us creates our first innings and opposition second', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post("/fixtures/{$fixture->id}/score", ['bats_first' => 'us'])
        ->assertRedirect();

    $fixture->refresh();
    $innings = $fixture->innings()->orderBy('sequence')->get();

    expect($fixture->first_innings_team_id)->toBe($team->id)
        ->and($innings)->toHaveCount(2)
        ->and($innings[0]->sequence)->toBe(1)
        ->and($innings[0]->batting_team_id)->toBe($team->id)
        ->and($innings[1]->sequence)->toBe(2)
        ->and($innings[1]->batting_team_id)->toBeNull();
});

test('an opposition innings delivery stores bowler_id and null striker_id and pair_id', function () {
    ['fixture' => $fixture, 'players' => $players, 'team' => $team] = createMatchFixtureSetup();

    createBothInnings($fixture, $team, 'them');

    $oppInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();
    $bowler = $players[0];

    $delivery = matchFlowService()->record($oppInnings, [
        'bowler_id' => $bowler->id,
        'runs' => 4,
    ]);

    expect($delivery->bowler_id)->toBe($bowler->id)
        ->and($delivery->striker_id)->toBeNull()
        ->and($delivery->pair_id)->toBeNull();
});

test('result returns ours_win with correct margin', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();

    createBothInnings($fixture, $team, 'us');

    $ourInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();
    $oppInnings = $fixture->innings()->where('sequence', 2)->firstOrFail();

    matchFlowService()->record($ourInnings, ['striker_id' => null, 'runs' => 120]);
    matchFlowService()->record($oppInnings, ['bowler_id' => null, 'runs' => 100]);

    $ourInnings->update(['completed_at' => now()]);
    $oppInnings->update(['completed_at' => now()]);

    expect(matchFlowService()->result($fixture))->toBe([
        'status' => 'ours_win',
        'margin' => 20,
        'our_total' => 120,
        'opp_total' => 100,
    ]);
});

test('result returns opposition_win with correct margin', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();

    createBothInnings($fixture, $team, 'them');

    $oppInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();
    $ourInnings = $fixture->innings()->where('sequence', 2)->firstOrFail();

    matchFlowService()->record($oppInnings, ['bowler_id' => null, 'runs' => 150]);
    matchFlowService()->record($ourInnings, ['striker_id' => null, 'runs' => 130]);

    $oppInnings->update(['completed_at' => now()]);
    $ourInnings->update(['completed_at' => now()]);

    expect(matchFlowService()->result($fixture))->toBe([
        'status' => 'opposition_win',
        'margin' => 20,
        'our_total' => 130,
        'opp_total' => 150,
    ]);
});

test('record requires striker_id for our innings', function () {
    ['fixture' => $fixture, 'players' => $players, 'team' => $team] = createMatchFixtureSetup();
    $user = User::factory()->create();

    createBothInnings($fixture, $team, 'us');

    $ourInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();

    $this->actingAs($user)
        ->post("/innings/{$ourInnings->id}/deliveries", [
            'runs' => 4,
        ])
        ->assertSessionHasErrors('striker_id');
});

test('record requires bowler_id for opposition innings', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();
    $user = User::factory()->create();

    createBothInnings($fixture, $team, 'them');

    $oppInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();

    $this->actingAs($user)
        ->post("/innings/{$oppInnings->id}/deliveries", [
            'runs' => 4,
        ])
        ->assertSessionHasErrors('bowler_id');
});

test('record accepts striker_id for our innings and bowler_id for opposition innings', function () {
    ['fixture' => $fixture, 'players' => $players, 'team' => $team] = createMatchFixtureSetup();
    $user = User::factory()->create();

    createBothInnings($fixture, $team, 'us');

    $ourInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();
    $oppInnings = $fixture->innings()->where('sequence', 2)->firstOrFail();

    $this->actingAs($user)
        ->post("/innings/{$ourInnings->id}/deliveries", [
            'striker_id' => $players[0]->id,
            'runs' => 4,
        ])
        ->assertRedirect("/innings/{$ourInnings->id}/score");

    $this->actingAs($user)
        ->post("/innings/{$oppInnings->id}/deliveries", [
            'bowler_id' => $players[1]->id,
            'runs' => 2,
        ])
        ->assertRedirect("/innings/{$oppInnings->id}/score");
});

test('result returns tie when totals are equal', function () {
    ['fixture' => $fixture, 'team' => $team] = createMatchFixtureSetup();

    createBothInnings($fixture, $team, 'us');

    $ourInnings = $fixture->innings()->where('sequence', 1)->firstOrFail();
    $oppInnings = $fixture->innings()->where('sequence', 2)->firstOrFail();

    matchFlowService()->record($ourInnings, ['striker_id' => null, 'runs' => 95]);
    matchFlowService()->record($oppInnings, ['bowler_id' => null, 'runs' => 95]);

    $ourInnings->update(['completed_at' => now()]);
    $oppInnings->update(['completed_at' => now()]);

    expect(matchFlowService()->result($fixture))->toBe([
        'status' => 'tie',
        'margin' => 0,
        'our_total' => 95,
        'opp_total' => 95,
    ]);
});
