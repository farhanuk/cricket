<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Innings;
use App\Models\Season;
use RuntimeException;

class StatsService
{
    public function __construct(
        protected ScoringService $scoringService,
    ) {}

    /**
     * @return list<array{
     *     player: string,
     *     runs: int,
     *     balls: int,
     *     fours: int,
     *     fives: int,
     *     sixes: int,
     *     dismissals: int
     * }>
     */
    public function battingCard(Innings $innings): array
    {
        $innings->loadMissing('fixture');
        $fixture = $innings->fixture;

        /** @var array<int, array{position: int, order: int}> $battingOrder */
        $battingOrder = [];

        foreach ($fixture->pairs()->get(['position', 'player_a_id', 'player_b_id']) as $pair) {
            $battingOrder[$pair->player_a_id] = ['position' => $pair->position, 'order' => 0];
            $battingOrder[$pair->player_b_id] = ['position' => $pair->position, 'order' => 1];
        }

        /** @var array<int, array{player_id: int, player: string, runs: int, balls: int, fours: int, fives: int, sixes: int, dismissals: int, first_delivery_id: int}> $byStriker */
        $byStriker = [];

        $deliveries = $innings->deliveries()
            ->whereNotNull('striker_id')
            ->with('striker')
            ->orderBy('id')
            ->get();

        foreach ($deliveries as $delivery) {
            $this->accumulateBattingDelivery($byStriker, $delivery);
        }

        $figures = array_values(array_filter(
            $byStriker,
            fn (array $stats) => $stats['balls'] >= 1,
        ));

        usort($figures, function (array $a, array $b) use ($battingOrder): int {
            $orderA = $battingOrder[$a['player_id']] ?? null;
            $orderB = $battingOrder[$b['player_id']] ?? null;

            if ($orderA !== null && $orderB !== null) {
                if ($orderA['position'] !== $orderB['position']) {
                    return $orderA['position'] <=> $orderB['position'];
                }

                return $orderA['order'] <=> $orderB['order'];
            }

            if ($orderA !== null) {
                return -1;
            }

            if ($orderB !== null) {
                return 1;
            }

            if ($a['runs'] !== $b['runs']) {
                return $b['runs'] <=> $a['runs'];
            }

            return $a['first_delivery_id'] <=> $b['first_delivery_id'];
        });

        return array_map(fn (array $stats) => [
            'player' => $stats['player'],
            'runs' => $stats['runs'],
            'balls' => $stats['balls'],
            'fours' => $stats['fours'],
            'fives' => $stats['fives'],
            'sixes' => $stats['sixes'],
            'dismissals' => $stats['dismissals'],
        ], $figures);
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
    public function bowlingCard(Innings $innings): array
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
            $this->accumulateBowlingDelivery($byBowler, $delivery);
        }

        $figures = [];

        foreach ($byBowler as $stats) {
            $figures[] = $this->formatBowlingRow($stats, $ballsPerOver);
        }

        usort($figures, fn (array $a, array $b) => strcmp($a['name'], $b['name']));

        return $figures;
    }

    /**
     * @return list<array{
     *     player: string,
     *     innings: int,
     *     runs: int,
     *     balls: int,
     *     strike_rate: float,
     *     fours: int,
     *     fives: int,
     *     sixes: int,
     *     dismissals: int,
     *     best: int
     * }>
     */
    public function seasonBatting(Season $season): array
    {
        $season->loadMissing('team');
        $teamId = $season->team_id;

        /** @var array<int, array{player: string, innings: int, runs: int, balls: int, fours: int, fives: int, sixes: int, dismissals: int, best: int}> $byPlayer */
        $byPlayer = [];

        $inningsList = Innings::query()
            ->whereHas('fixture', fn ($query) => $query->where('season_id', $season->id))
            ->where('batting_team_id', $teamId)
            ->with(['deliveries.striker'])
            ->get();

        foreach ($inningsList as $innings) {
            /** @var array<int, array{player_id: int, player: string, runs: int, balls: int, fours: int, fives: int, sixes: int, dismissals: int, first_delivery_id: int}> $inningsStrikers */
            $inningsStrikers = [];

            foreach ($innings->deliveries->whereNotNull('striker_id') as $delivery) {
                $this->accumulateBattingDelivery($inningsStrikers, $delivery);
            }

            foreach ($inningsStrikers as $strikerId => $stats) {
                if ($stats['balls'] < 1) {
                    continue;
                }

                if (! isset($byPlayer[$strikerId])) {
                    $byPlayer[$strikerId] = [
                        'player' => $stats['player'],
                        'innings' => 0,
                        'runs' => 0,
                        'balls' => 0,
                        'fours' => 0,
                        'fives' => 0,
                        'sixes' => 0,
                        'dismissals' => 0,
                        'best' => 0,
                    ];
                }

                $byPlayer[$strikerId]['innings']++;
                $byPlayer[$strikerId]['runs'] += $stats['runs'];
                $byPlayer[$strikerId]['balls'] += $stats['balls'];
                $byPlayer[$strikerId]['fours'] += $stats['fours'];
                $byPlayer[$strikerId]['fives'] += $stats['fives'];
                $byPlayer[$strikerId]['sixes'] += $stats['sixes'];
                $byPlayer[$strikerId]['dismissals'] += $stats['dismissals'];
                $byPlayer[$strikerId]['best'] = max($byPlayer[$strikerId]['best'], $stats['runs']);
            }
        }

        $rows = array_map(function (array $stats) {
            $strikeRate = $stats['balls'] > 0
                ? round($stats['runs'] / $stats['balls'] * 100, 1)
                : 0.0;

            return [
                ...$stats,
                'strike_rate' => $strikeRate,
            ];
        }, array_values($byPlayer));

        usort($rows, fn (array $a, array $b) => $b['runs'] <=> $a['runs']);

        return $rows;
    }

    /**
     * @return list<array{
     *     player: string,
     *     overs: string,
     *     runs: int,
     *     wickets: int,
     *     economy: float,
     *     wides: int,
     *     no_balls: int,
     *     best: string
     * }>
     */
    public function seasonBowling(Season $season): array
    {
        /** @var array<int, array{player: string, counting_balls: int, runs: int, wickets: int, wides: int, no_balls: int, overs_decimal: float, best_wickets: int, best_runs: int}> $byPlayer */
        $byPlayer = [];

        $inningsList = Innings::query()
            ->whereHas('fixture', fn ($query) => $query->where('season_id', $season->id))
            ->whereNull('batting_team_id')
            ->with(['deliveries.bowler', 'fixture'])
            ->get();

        foreach ($inningsList as $innings) {
            $ballsPerOver = $innings->fixture->balls_per_over;

            /** @var array<int, array{player_id: int, name: string, counting_balls: int, runs: int, wickets: int, wides: int, no_balls: int}> $inningsBowlers */
            $inningsBowlers = [];

            foreach ($innings->deliveries->whereNotNull('bowler_id') as $delivery) {
                $this->accumulateBowlingDelivery($inningsBowlers, $delivery);
            }

            foreach ($inningsBowlers as $bowlerId => $stats) {
                if (! isset($byPlayer[$bowlerId])) {
                    $byPlayer[$bowlerId] = [
                        'player' => $stats['name'],
                        'counting_balls' => 0,
                        'runs' => 0,
                        'wickets' => 0,
                        'wides' => 0,
                        'no_balls' => 0,
                        'overs_decimal' => 0.0,
                        'best_wickets' => 0,
                        'best_runs' => 0,
                    ];
                }

                $byPlayer[$bowlerId]['counting_balls'] += $stats['counting_balls'];
                $byPlayer[$bowlerId]['runs'] += $stats['runs'];
                $byPlayer[$bowlerId]['wickets'] += $stats['wickets'];
                $byPlayer[$bowlerId]['wides'] += $stats['wides'];
                $byPlayer[$bowlerId]['no_balls'] += $stats['no_balls'];
                $byPlayer[$bowlerId]['overs_decimal'] += $stats['counting_balls'] / $ballsPerOver;

                if (
                    $stats['wickets'] > $byPlayer[$bowlerId]['best_wickets']
                    || (
                        $stats['wickets'] === $byPlayer[$bowlerId]['best_wickets']
                        && $stats['runs'] < $byPlayer[$bowlerId]['best_runs']
                    )
                ) {
                    $byPlayer[$bowlerId]['best_wickets'] = $stats['wickets'];
                    $byPlayer[$bowlerId]['best_runs'] = $stats['runs'];
                }
            }
        }

        $defaultBallsPerOver = (int) ($season->fixtures()->value('balls_per_over') ?? 6);

        $rows = [];

        foreach ($byPlayer as $stats) {
            $economy = $stats['overs_decimal'] > 0
                ? round($stats['runs'] / $stats['overs_decimal'], 1)
                : 0.0;

            $rows[] = [
                'player' => $stats['player'],
                'overs' => $this->formatOvers($stats['counting_balls'], $defaultBallsPerOver),
                'runs' => $stats['runs'],
                'wickets' => $stats['wickets'],
                'economy' => $economy,
                'wides' => $stats['wides'],
                'no_balls' => $stats['no_balls'],
                'best' => "{$stats['best_wickets']}/{$stats['best_runs']}",
            ];
        }

        usort($rows, function (array $a, array $b) {
            if ($a['wickets'] !== $b['wickets']) {
                return $b['wickets'] <=> $a['wickets'];
            }

            return $a['economy'] <=> $b['economy'];
        });

        return $rows;
    }

    /**
     * @return array{played: int, won: int, lost: int, tied: int}
     */
    public function teamRecord(Season $season): array
    {
        $played = 0;
        $won = 0;
        $lost = 0;
        $tied = 0;

        $fixtures = $season->fixtures()
            ->with(['innings' => fn ($query) => $query->orderBy('sequence')])
            ->get();

        foreach ($fixtures as $fixture) {
            if ($fixture->innings->count() !== 2) {
                continue;
            }

            if ($fixture->innings->contains(fn (Innings $innings) => $innings->completed_at === null)) {
                continue;
            }

            try {
                $result = $this->scoringService->result($fixture);
            } catch (RuntimeException) {
                continue;
            }

            $played++;

            match ($result['status']) {
                'ours_win' => $won++,
                'opposition_win' => $lost++,
                'tie' => $tied++,
            };
        }

        return compact('played', 'won', 'lost', 'tied');
    }

    /**
     * @param  array<int, array{player_id: int, player: string, runs: int, balls: int, fours: int, fives: int, sixes: int, dismissals: int, first_delivery_id: int}>  $byStriker
     */
    protected function accumulateBattingDelivery(array &$byStriker, Delivery $delivery): void
    {
        $strikerId = $delivery->striker_id;

        if (! isset($byStriker[$strikerId])) {
            $squadNumber = $delivery->striker->squad_number;
            $byStriker[$strikerId] = [
                'player_id' => $strikerId,
                'player' => ($squadNumber !== null ? "{$squadNumber} " : '').$delivery->striker->name,
                'runs' => 0,
                'balls' => 0,
                'fours' => 0,
                'fives' => 0,
                'sixes' => 0,
                'dismissals' => 0,
                'first_delivery_id' => $delivery->id,
            ];
        }

        $byStriker[$strikerId]['runs'] += $delivery->runs;

        if ($delivery->counts_toward_over) {
            $byStriker[$strikerId]['balls']++;
        }

        if ($delivery->runs === 4 && ! $delivery->is_out && $delivery->extra_type === null) {
            $byStriker[$strikerId]['fours']++;
        }

        if ($delivery->runs === 5 && ! $delivery->is_out && $delivery->extra_type === null) {
            $byStriker[$strikerId]['fives']++;
        }

        if ($delivery->runs === 6 && ! $delivery->is_out && $delivery->extra_type === null) {
            $byStriker[$strikerId]['sixes']++;
        }

        if ($delivery->is_out) {
            $byStriker[$strikerId]['dismissals']++;
        }
    }

    /**
     * @param  array<int, array{player_id: int, name: string, counting_balls: int, runs: int, wickets: int, wides: int, no_balls: int}>  $byBowler
     */
    protected function accumulateBowlingDelivery(array &$byBowler, Delivery $delivery): void
    {
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

    /**
     * @param  array{player_id: int, name: string, counting_balls: int, runs: int, wickets: int, wides: int, no_balls: int}  $stats
     * @return array{name: string, overs: string, runs: int, wickets: int, economy: float, wides: int, no_balls: int}
     */
    protected function formatBowlingRow(array $stats, int $ballsPerOver): array
    {
        $oversDecimal = $stats['counting_balls'] / $ballsPerOver;
        $economy = $oversDecimal > 0
            ? round($stats['runs'] / $oversDecimal, 1)
            : 0.0;

        return [
            'name' => $stats['name'],
            'overs' => $this->formatOvers($stats['counting_balls'], $ballsPerOver),
            'runs' => $stats['runs'],
            'wickets' => $stats['wickets'],
            'economy' => $economy,
            'wides' => $stats['wides'],
            'no_balls' => $stats['no_balls'],
        ];
    }

    protected function formatOvers(int $countingBalls, int $ballsPerOver): string
    {
        $completedOvers = intdiv($countingBalls, $ballsPerOver);
        $partialBalls = $countingBalls % $ballsPerOver;

        return $partialBalls === 0
            ? (string) $completedOvers
            : "{$completedOvers}.{$partialBalls}";
    }

}
