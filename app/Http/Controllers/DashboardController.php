<?php

namespace App\Http\Controllers;

use App\Models\Fixture;
use App\Models\Season;
use App\Services\ScoringService;
use App\Services\StatsService;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class DashboardController extends Controller
{
    /**
     * Show the dashboard with season summary stats.
     */
    public function index(StatsService $statsService, ScoringService $scoringService): Response
    {
        $season = Season::query()->latest()->first();

        if ($season === null) {
            return Inertia::render('dashboard', [
                'teamRecord' => [
                    'played' => 0,
                    'won' => 0,
                    'lost' => 0,
                    'tied' => 0,
                ],
                'topBatsmen' => [],
                'topBowlers' => [],
                'recentFixtures' => [],
            ]);
        }

        $topBatsmen = collect($statsService->seasonBatting($season))
            ->take(5)
            ->map(fn (array $row) => [
                'name' => $row['player'],
                'runs' => $row['runs'],
                'innings' => $row['innings'],
            ])
            ->values()
            ->all();

        $topBowlers = collect($statsService->seasonBowling($season))
            ->take(5)
            ->map(fn (array $row) => [
                'name' => $row['player'],
                'wickets' => $row['wickets'],
                'overs' => $row['overs'],
            ])
            ->values()
            ->all();

        $recentFixtures = Fixture::query()
            ->where('season_id', $season->id)
            ->orderByRaw('played_at IS NULL, played_at DESC')
            ->limit(5)
            ->get(['id', 'opponent', 'played_at'])
            ->map(function (Fixture $fixture) use ($scoringService) {
                $resultLabel = null;

                try {
                    $result = $scoringService->result($fixture);

                    $resultLabel = match ($result['status']) {
                        'ours_win' => 'Won by '.$result['margin'],
                        'opposition_win' => 'Lost by '.$result['margin'],
                        'tie' => 'Tied',
                    };
                } catch (RuntimeException) {
                    // Match not complete yet.
                }

                return [
                    'id' => $fixture->id,
                    'opponent' => $fixture->opponent,
                    'played_at' => $fixture->played_at,
                    'result' => $resultLabel,
                ];
            })
            ->values()
            ->all();

        return Inertia::render('dashboard', [
            'teamRecord' => $statsService->teamRecord($season),
            'topBatsmen' => $topBatsmen,
            'topBowlers' => $topBowlers,
            'recentFixtures' => $recentFixtures,
        ]);
    }
}
