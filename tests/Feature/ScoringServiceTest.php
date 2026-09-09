<?php

use App\Models\Fixture;
use App\Models\Innings;
use App\Models\Pair;
use App\Models\Player;
use App\Models\Season;
use App\Models\Selection;
use App\Models\Team;
use App\Services\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function scoringService(): ScoringService
{
    return app(ScoringService::class);
}

function createUsInningsSetup(): array
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

    $innings = Innings::factory()->for($fixture)->create([
        'batting_team_id' => $team->id,
        'sequence' => 1,
    ]);

    return compact('fixture', 'innings', 'players', 'team');
}

function recordNormalDeliveries(Innings $innings, int $count, array $overrides = []): void
{
    for ($i = 0; $i < $count; $i++) {
        scoringService()->record($innings, [
            'runs' => 0,
            ...$overrides,
        ]);
    }
}

test('six normal deliveries fill over 1 and the seventh delivery is recorded in over 2', function () {
    ['innings' => $innings] = createUsInningsSetup();

    recordNormalDeliveries($innings, 6);

    $state = scoringService()->state($innings);
    expect($state['over_no'])->toBe(2)
        ->and($state['balls_bowled_this_over'])->toBe(0);

    $seventh = scoringService()->record($innings, ['runs' => 1]);

    expect($seventh->over_no)->toBe(2)
        ->and($seventh->ball_no)->toBe(1)
        ->and($seventh->counts_toward_over)->toBeTrue();
});

test('an out recorded with runs of -5 reduces total runs by 5', function () {
    ['innings' => $innings, 'players' => $players] = createUsInningsSetup();

    scoringService()->record($innings, [
        'striker_id' => $players[0]->id,
        'runs' => 10,
    ]);

    scoringService()->record($innings, [
        'striker_id' => $players[0]->id,
        'runs' => -5,
        'is_out' => true,
    ]);

    expect(scoringService()->state($innings)['total_runs'])->toBe(5);
});

test('us innings still stores striker_id after an out', function () {
    ['innings' => $innings, 'players' => $players] = createUsInningsSetup();

    $delivery = scoringService()->record($innings, [
        'striker_id' => $players[0]->id,
        'runs' => -5,
        'is_out' => true,
    ]);

    expect($delivery->striker_id)->toBe($players[0]->id)
        ->and($delivery->is_out)->toBeTrue();
});

test('a wide in over 1 counts toward the over', function () {
    ['innings' => $innings] = createUsInningsSetup();

    $wide = scoringService()->record($innings, [
        'runs' => 1,
        'extra_type' => 'wide',
    ]);

    expect($wide->over_no)->toBe(1)
        ->and($wide->counts_toward_over)->toBeTrue()
        ->and($wide->ball_no)->toBe(1);
});

test('a wide in the last over does not count toward the over', function () {
    ['innings' => $innings] = createUsInningsSetup();

    recordNormalDeliveries($innings, 66);

    $wide = scoringService()->record($innings, [
        'runs' => 1,
        'extra_type' => 'wide',
    ]);

    expect($wide->over_no)->toBe(12)
        ->and($wide->counts_toward_over)->toBeFalse()
        ->and($wide->ball_no)->toBeNull();
});

test('us innings assigns pair position 2 in over 4 and position 3 in over 7', function () {
    ['fixture' => $fixture, 'innings' => $innings] = createUsInningsSetup();

    $pairTwo = $fixture->pairs()->where('position', 2)->first();
    $pairThree = $fixture->pairs()->where('position', 3)->first();

    recordNormalDeliveries($innings, 18);
    $overFour = scoringService()->record($innings, ['runs' => 0]);

    expect($overFour->over_no)->toBe(4)
        ->and($overFour->pair_id)->toBe($pairTwo->id);

    recordNormalDeliveries($innings, 17);
    $overSeven = scoringService()->record($innings, ['runs' => 0]);

    expect($overSeven->over_no)->toBe(7)
        ->and($overSeven->pair_id)->toBe($pairThree->id);
});

test('isComplete is based on completed_at not ball count', function () {
    ['innings' => $innings] = createUsInningsSetup();

    expect(scoringService()->isComplete($innings))->toBeFalse();

    recordNormalDeliveries($innings, 72);

    expect(scoringService()->isComplete($innings))->toBeFalse()
        ->and(scoringService()->state($innings)['is_complete'])->toBeFalse()
        ->and(scoringService()->state($innings)['balls_remaining'])->toBe(0);

    $innings->update(['completed_at' => now()]);

    expect(scoringService()->isComplete($innings))->toBeTrue()
        ->and(scoringService()->state($innings)['is_complete'])->toBeTrue();
});

test('record throws only when the innings has been explicitly completed', function () {
    ['innings' => $innings] = createUsInningsSetup();

    recordNormalDeliveries($innings, 72);

    scoringService()->record($innings, ['runs' => 1]);

    expect($innings->deliveries()->count())->toBe(73);

    $innings->update(['completed_at' => now()]);

    scoringService()->record($innings, ['runs' => 1]);
})->throws(RuntimeException::class, 'Innings is already complete.');

test('player run totals follow striker_id after mid-innings pair edits', function () {
    ['fixture' => $fixture, 'innings' => $innings, 'players' => $players] = createUsInningsSetup();

    $playerA = $players[0];
    $playerB = $players[1];

    scoringService()->record($innings, ['striker_id' => $playerA->id, 'runs' => 4]);
    scoringService()->record($innings, ['striker_id' => $playerA->id, 'runs' => 6]);
    scoringService()->record($innings, ['striker_id' => $playerA->id, 'runs' => 2]);
    scoringService()->record($innings, ['striker_id' => $playerB->id, 'runs' => 3]);
    scoringService()->record($innings, ['striker_id' => $playerB->id, 'runs' => 1]);

    $playerATotalBefore = (int) $innings->deliveries()
        ->where('striker_id', $playerA->id)
        ->sum('runs');
    $playerBTotalBefore = (int) $innings->deliveries()
        ->where('striker_id', $playerB->id)
        ->sum('runs');
    $totalsBefore = scoringService()->playerRunTotals($innings);

    expect($playerATotalBefore)->toBe(12)
        ->and($playerBTotalBefore)->toBe(4)
        ->and($totalsBefore[$playerA->id]['runs'])->toBe(12)
        ->and($totalsBefore[$playerA->id]['balls_faced'])->toBe(3)
        ->and($totalsBefore[$playerB->id]['runs'])->toBe(4)
        ->and($totalsBefore[$playerB->id]['balls_faced'])->toBe(2);

    $pairOne = $fixture->pairs()->where('position', 1)->first();
    $pairThree = $fixture->pairs()->where('position', 3)->first();

    $pairOne->update(['player_a_id' => $pairThree->player_a_id]);
    $pairThree->update(['player_a_id' => $playerA->id]);

    $playerATotalAfter = (int) $innings->deliveries()
        ->where('striker_id', $playerA->id)
        ->sum('runs');
    $playerBTotalAfter = (int) $innings->deliveries()
        ->where('striker_id', $playerB->id)
        ->sum('runs');
    $totalsAfter = scoringService()->playerRunTotals($innings);

    expect($playerATotalAfter)->toBe(12)
        ->and($playerBTotalAfter)->toBe(4)
        ->and($totalsAfter[$playerA->id]['runs'])->toBe(12)
        ->and($totalsAfter[$playerA->id]['balls_faced'])->toBe(3)
        ->and($totalsAfter[$playerB->id]['runs'])->toBe(4)
        ->and($totalsAfter[$playerB->id]['balls_faced'])->toBe(2);
});

test('undoLast removes exactly the last delivery', function () {
    ['innings' => $innings] = createUsInningsSetup();

    scoringService()->record($innings, ['runs' => 1]);
    scoringService()->record($innings, ['runs' => 2]);
    scoringService()->record($innings, ['runs' => 4]);

    expect($innings->deliveries()->count())->toBe(3)
        ->and(scoringService()->state($innings)['total_runs'])->toBe(7);

    scoringService()->undoLast($innings);

    expect($innings->deliveries()->count())->toBe(2)
        ->and(scoringService()->state($innings)['total_runs'])->toBe(3);
});
