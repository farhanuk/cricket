<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Fixture;
use App\Models\Innings;
use RuntimeException;

class ScoringService
{
    /**
     * Record a delivery for the given innings.
     *
     * @param  array{striker_id?: int|null, bowler_id?: int|null, runs: int, is_out?: bool, extra_type?: null|'wide'|'no_ball'}  $input
     */
    public function record(Innings $innings, array $input): Delivery
    {
        if ($this->isComplete($innings)) {
            throw new RuntimeException('Innings is already complete.');
        }

        $innings->loadMissing('fixture');
        $fixture = $innings->fixture;
        $ballsPerOver = $fixture->balls_per_over;

        $countingSoFar = $this->countingDeliveries($innings);
        $overNo = intdiv($countingSoFar, $ballsPerOver) + 1;

        $extraType = $input['extra_type'] ?? null;
        $countsTowardOver = ! ($overNo === $fixture->overs && $extraType !== null);

        $ballNo = $countsTowardOver
            ? ($countingSoFar % $ballsPerOver) + 1
            : null;

        $strikerId = $input['striker_id'] ?? null;
        $bowlerId = $input['bowler_id'] ?? null;
        $pairId = null;

        if ($innings->isOurs()) {
            $pairPosition = $this->pairPositionForOver($fixture, $overNo);
            $pairId = $fixture->pairs()
                ->where('position', $pairPosition)
                ->value('id');
            $bowlerId = null;
        } else {
            $strikerId = null;
            $pairId = null;
        }

        return $innings->deliveries()->create([
            'pair_id' => $pairId,
            'over_no' => $overNo,
            'ball_no' => $ballNo,
            'striker_id' => $strikerId,
            'bowler_id' => $bowlerId,
            'runs' => $input['runs'],
            'is_out' => $input['is_out'] ?? false,
            'extra_type' => $extraType,
            'counts_toward_over' => $countsTowardOver,
        ]);
    }

    public function undoLast(Innings $innings): void
    {
        $delivery = $innings->deliveries()->orderByDesc('id')->first();

        if ($delivery !== null) {
            $delivery->delete();
        }
    }

    public function isComplete(Innings $innings): bool
    {
        return $innings->completed_at !== null;
    }

    /**
     * @return array{
     *     over_no: int,
     *     balls_bowled_this_over: int,
     *     balls_per_over: int,
     *     is_last_over: bool,
     *     total_runs: int,
     *     wickets: int,
     *     is_complete: bool,
     *     balls_remaining: int,
     *     current_pair: array{position: int, players: list<array{id: int, name: string, squad_number: int|null}>}|null
     * }
     */
    public function state(Innings $innings): array
    {
        $innings->loadMissing('fixture');
        $fixture = $innings->fixture;
        $ballsPerOver = $fixture->balls_per_over;
        $countingSoFar = $this->countingDeliveries($innings);
        $legalBallLimit = $fixture->overs * $ballsPerOver;
        $overNo = intdiv($countingSoFar, $ballsPerOver) + 1;

        $currentPair = null;

        if ($innings->isOurs()) {
            $pairPosition = $this->pairPositionForOver($fixture, $overNo);
            $pair = $fixture->pairs()
                ->with(['playerA', 'playerB'])
                ->where('position', $pairPosition)
                ->first();

            if ($pair !== null) {
                $currentPair = [
                    'position' => $pair->position,
                    'players' => [
                        $pair->playerA->only(['id', 'name', 'squad_number']),
                        $pair->playerB->only(['id', 'name', 'squad_number']),
                    ],
                ];
            }
        }

        return [
            'over_no' => $overNo,
            'balls_bowled_this_over' => $countingSoFar % $ballsPerOver,
            'balls_per_over' => $ballsPerOver,
            'is_last_over' => $overNo === $fixture->overs,
            'total_runs' => (int) $innings->deliveries()->sum('runs'),
            'wickets' => $innings->deliveries()->where('is_out', true)->count(),
            'is_complete' => $innings->completed_at !== null,
            'balls_remaining' => max(0, $legalBallLimit - $countingSoFar),
            'current_pair' => $currentPair,
        ];
    }

    /**
     * @return array<int, array{runs: int, balls_faced: int}>
     */
    public function playerRunTotals(Innings $innings): array
    {
        $totals = [];

        $deliveries = $innings->deliveries()
            ->whereNotNull('striker_id')
            ->get(['striker_id', 'runs', 'counts_toward_over']);

        foreach ($deliveries as $delivery) {
            $strikerId = $delivery->striker_id;

            if (! isset($totals[$strikerId])) {
                $totals[$strikerId] = ['runs' => 0, 'balls_faced' => 0];
            }

            $totals[$strikerId]['runs'] += $delivery->runs;

            if ($delivery->counts_toward_over) {
                $totals[$strikerId]['balls_faced']++;
            }
        }

        return $totals;
    }

    /**
     * @return list<array{id: int, runs: int, extra_type: null|string}>
     */
    public function currentOverDeliveries(Innings $innings): array
    {
        $overNo = $this->state($innings)['over_no'];

        return $innings->deliveries()
            ->where('over_no', $overNo)
            ->orderBy('id')
            ->get(['id', 'runs', 'extra_type'])
            ->map(fn (Delivery $delivery) => [
                'id' => $delivery->id,
                'runs' => $delivery->runs,
                'extra_type' => $delivery->extra_type,
            ])
            ->values()
            ->all();
    }

    public function currentOverBowlerId(Innings $innings): ?int
    {
        $overNo = $this->state($innings)['over_no'];

        return $innings->deliveries()
            ->where('over_no', $overNo)
            ->whereNotNull('bowler_id')
            ->orderBy('id')
            ->value('bowler_id');
    }

    public function currentOverStrikerId(Innings $innings): ?int
    {
        $overNo = $this->state($innings)['over_no'];

        return $innings->deliveries()
            ->where('over_no', $overNo)
            ->whereNotNull('striker_id')
            ->orderByDesc('id')
            ->value('striker_id');
    }

    public function previousOverBowlerId(Innings $innings): ?int
    {
        $currentOver = $this->state($innings)['over_no'];

        if ($currentOver <= 1) {
            return null;
        }

        return $innings->deliveries()
            ->where('over_no', $currentOver - 1)
            ->whereNotNull('bowler_id')
            ->orderByDesc('id')
            ->value('bowler_id');
    }

    /**
     * @return list<array{
     *     name: string,
     *     overs: string,
     *     runs: int,
     *     wickets: int,
     *     economy: float,
     *     wides: int,
     *     no_balls: int
     * }>
     */
    public function bowlingFigures(Innings $innings): array
    {
        $innings->loadMissing('fixture');
        $ballsPerOver = $innings->fixture->balls_per_over;

        /** @var array<int, array{player_id: int, name: string, counting_balls: int, runs: int, wickets: int, wides: int, no_balls: int}> $byBowler */
        $byBowler = [];

        $deliveries = $innings->deliveries()
            ->whereNotNull('bowler_id')
            ->with('bowler')
            ->get();

        foreach ($deliveries as $delivery) {
            $bowlerId = $delivery->bowler_id;

            if (! isset($byBowler[$bowlerId])) {
                $byBowler[$bowlerId] = [
                    'player_id' => $bowlerId,
                    'name' => $delivery->bowler->name,
                    'counting_balls' => 0,
                    'runs' => 0,
                    'wickets' => 0,
                    'wides' => 0,
                    'no_balls' => 0,
                ];
            }

            $byBowler[$bowlerId]['runs'] += $delivery->runs;

            if ($delivery->is_out) {
                $byBowler[$bowlerId]['wickets']++;
            }

            if ($delivery->extra_type === 'wide') {
                $byBowler[$bowlerId]['wides']++;
            }

            if ($delivery->extra_type === 'no_ball') {
                $byBowler[$bowlerId]['no_balls']++;
            }

            if ($delivery->counts_toward_over) {
                $byBowler[$bowlerId]['counting_balls']++;
            }
        }

        $figures = [];

        foreach ($byBowler as $stats) {
            $completedOvers = intdiv($stats['counting_balls'], $ballsPerOver);
            $partialBalls = $stats['counting_balls'] % $ballsPerOver;
            $oversDisplay = $partialBalls === 0
                ? (string) $completedOvers
                : "{$completedOvers}.{$partialBalls}";

            $oversDecimal = $stats['counting_balls'] / $ballsPerOver;
            $economy = $oversDecimal > 0
                ? round($stats['runs'] / $oversDecimal, 1)
                : 0.0;

            $figures[] = [
                'name' => $stats['name'],
                'overs' => $oversDisplay,
                'runs' => $stats['runs'],
                'wickets' => $stats['wickets'],
                'economy' => $economy,
                'wides' => $stats['wides'],
                'no_balls' => $stats['no_balls'],
            ];
        }

        usort($figures, fn (array $a, array $b) => strcmp($a['name'], $b['name']));

        return $figures;
    }

    /**
     * @return list<array{position: int, label: string}>
     */
    public function upcomingPairs(Fixture $fixture, int $currentPairPosition): array
    {
        return $fixture->pairs()
            ->with(['playerA', 'playerB'])
            ->where('position', '>', $currentPairPosition)
            ->orderBy('position')
            ->get()
            ->map(fn ($pair) => [
                'position' => $pair->position,
                'label' => "Pair {$pair->position}: {$pair->playerA->name} & {$pair->playerB->name}",
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{
     *     status: 'ours_win'|'opposition_win'|'tie',
     *     margin: int,
     *     our_total: int,
     *     opp_total: int
     * }
     */
    public function result(Fixture $fixture): array
    {
        $fixture->load(['innings' => fn ($query) => $query->orderBy('sequence'), 'season']);

        $innings = $fixture->innings;

        if ($innings->count() !== 2) {
            throw new RuntimeException('Both innings are required to calculate a result.');
        }

        foreach ($innings as $inningsEntry) {
            if ($inningsEntry->completed_at === null) {
                throw new RuntimeException('Both innings must be complete to calculate a result.');
            }
        }

        $teamId = $fixture->season->team_id;

        $ourInnings = $innings->first(fn (Innings $entry) => $entry->batting_team_id === $teamId);
        $oppInnings = $innings->first(fn (Innings $entry) => $entry->batting_team_id === null);

        if ($ourInnings === null || $oppInnings === null) {
            throw new RuntimeException('Could not identify our and opposition innings.');
        }

        $ourTotal = (int) $ourInnings->deliveries()->sum('runs');
        $oppTotal = (int) $oppInnings->deliveries()->sum('runs');

        if ($ourTotal > $oppTotal) {
            return [
                'status' => 'ours_win',
                'margin' => $ourTotal - $oppTotal,
                'our_total' => $ourTotal,
                'opp_total' => $oppTotal,
            ];
        }

        if ($oppTotal > $ourTotal) {
            return [
                'status' => 'opposition_win',
                'margin' => $oppTotal - $ourTotal,
                'our_total' => $ourTotal,
                'opp_total' => $oppTotal,
            ];
        }

        return [
            'status' => 'tie',
            'margin' => 0,
            'our_total' => $ourTotal,
            'opp_total' => $oppTotal,
        ];
    }

    protected function countingDeliveries(Innings $innings): int
    {
        return $innings->deliveries()
            ->where('counts_toward_over', true)
            ->count();
    }

    protected function pairPositionForOver(Fixture $fixture, int $overNo): int
    {
        $oversPerPair = intdiv($fixture->overs, 4);

        return min(4, intdiv($overNo - 1, $oversPerPair) + 1);
    }
}
