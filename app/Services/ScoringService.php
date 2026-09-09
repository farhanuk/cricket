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
        $pairId = null;

        if ($innings->batting_side === 'us') {
            $pairPosition = $this->pairPositionForOver($fixture, $overNo);
            $pairId = $fixture->pairs()
                ->where('position', $pairPosition)
                ->value('id');
        } else {
            $strikerId = null;
        }

        return $innings->deliveries()->create([
            'pair_id' => $pairId,
            'over_no' => $overNo,
            'ball_no' => $ballNo,
            'striker_id' => $strikerId,
            'bowler_id' => $input['bowler_id'] ?? null,
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

        if ($innings->batting_side === 'us') {
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
