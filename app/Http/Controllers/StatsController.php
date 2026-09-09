<?php

namespace App\Http\Controllers;

use App\Models\Season;
use App\Services\StatsService;
use Inertia\Inertia;
use Inertia\Response;

class StatsController extends Controller
{
    /**
     * Show season statistics.
     */
    public function index(StatsService $statsService): Response
    {
        $season = Season::query()->latest()->firstOrFail();
        $season->load('team');

        return Inertia::render('stats/index', [
            'season' => $season->only(['id', 'name']),
            'team' => $season->team->only(['id', 'name']),
            'teamRecord' => $statsService->teamRecord($season),
            'batting' => $statsService->seasonBatting($season),
            'bowling' => $statsService->seasonBowling($season),
        ]);
    }
}
