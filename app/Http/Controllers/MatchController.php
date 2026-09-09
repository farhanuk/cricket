<?php

namespace App\Http\Controllers;

use App\Models\Fixture;
use App\Services\ScoringService;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class MatchController extends Controller
{
    /**
     * Show a JSON-ready match summary for a fixture.
     */
    public function show(Fixture $fixture, ScoringService $scoringService): JsonResponse
    {
        $fixture->load(['season.team', 'innings' => fn ($query) => $query->orderBy('sequence')]);

        $inningsSummaries = $fixture->innings->map(function ($innings) use ($scoringService) {
            $state = $scoringService->state($innings);

            return [
                'id' => $innings->id,
                'sequence' => $innings->sequence,
                'batting_team_id' => $innings->batting_team_id,
                'is_ours' => $innings->isOurs(),
                'completed_at' => $innings->completed_at,
                'total_runs' => $state['total_runs'],
                'wickets' => $state['wickets'],
                'is_complete' => $state['is_complete'],
            ];
        });

        $result = null;

        try {
            $result = $scoringService->result($fixture);
        } catch (RuntimeException) {
            // Result not ready yet.
        }

        return response()->json([
            'fixture' => $fixture->only(['id', 'opponent', 'overs', 'balls_per_over', 'first_innings_team_id']),
            'team' => $fixture->season->team->only(['id', 'name']),
            'innings' => $inningsSummaries,
            'result' => $result,
        ]);
    }
}
