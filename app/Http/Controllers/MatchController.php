<?php

namespace App\Http\Controllers;

use App\Models\Fixture;
use App\Services\ScoringService;
use App\Services\StatsService;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class MatchController extends Controller
{
    /**
     * Show the match hub for a fixture.
     */
    public function show(Fixture $fixture, ScoringService $scoringService): Response
    {
        $fixture->load(['season.team', 'innings' => fn ($query) => $query->orderBy('sequence')]);

        $team = $fixture->season->team;

        $inningsSummaries = $fixture->innings->map(function ($innings) use ($fixture, $team, $scoringService) {
            $state = $scoringService->state($innings);

            return [
                'id' => $innings->id,
                'sequence' => $innings->sequence,
                'batting_team_id' => $innings->batting_team_id,
                'is_ours' => $innings->isOurs(),
                'batting_side_name' => $innings->isOurs() ? $team->name : $fixture->opponent,
                'total_runs' => $state['total_runs'],
                'wickets' => $state['wickets'],
                'is_complete' => $state['is_complete'],
                'has_deliveries' => $innings->deliveries()->exists(),
            ];
        });

        $result = null;

        try {
            $result = $scoringService->result($fixture);
        } catch (RuntimeException) {
            // Result not ready yet.
        }

        return Inertia::render('match/index', [
            'fixture' => $fixture->only([
                'id',
                'opponent',
                'overs',
                'balls_per_over',
                'first_innings_team_id',
            ]),
            'team' => $team->only(['id', 'name']),
            'innings' => $inningsSummaries,
            'result' => $result,
            'match_started' => $fixture->innings()->exists(),
        ]);
    }

    /**
     * Show the full scorecard for a fixture.
     */
    public function scorecard(Fixture $fixture, ScoringService $scoringService, StatsService $statsService): Response
    {
        $fixture->load(['season.team', 'innings' => fn ($query) => $query->orderBy('sequence')]);

        $team = $fixture->season->team;

        $inningsCards = $fixture->innings->map(function ($innings) use ($fixture, $team, $scoringService, $statsService) {
            $state = $scoringService->state($innings);

            return [
                'sequence' => $innings->sequence,
                'batting_side_name' => $innings->isOurs() ? $team->name : $fixture->opponent,
                'bowling_side_name' => $innings->isOurs() ? $fixture->opponent : $team->name,
                'total_runs' => $state['total_runs'],
                'wickets' => $state['wickets'],
                'is_complete' => $state['is_complete'],
                'batting' => $statsService->battingCard($innings),
                'bowling' => $statsService->bowlingCard($innings),
            ];
        });

        $result = null;
        $matchComplete = $fixture->innings->count() === 2
            && $fixture->innings->every(fn ($innings) => $innings->completed_at !== null);

        if ($matchComplete) {
            try {
                $result = $scoringService->result($fixture);
            } catch (RuntimeException) {
                // Result not ready yet.
            }
        }

        return Inertia::render('match/scorecard', [
            'fixture' => $fixture->only([
                'id',
                'opponent',
                'played_at',
                'venue',
            ]),
            'team' => $team->only(['id', 'name']),
            'innings' => $inningsCards,
            'result' => $result,
            'matchComplete' => $matchComplete,
        ]);
    }
}
