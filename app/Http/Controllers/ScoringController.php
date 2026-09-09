<?php

namespace App\Http\Controllers;

use App\Models\Fixture;
use App\Models\Innings;
use App\Models\Player;
use App\Services\ScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ScoringController extends Controller
{
    /**
     * Start or resume scoring for a fixture.
     */
    public function start(Request $request, Fixture $fixture): RedirectResponse
    {
        $fixture->load('season');

        if ($fixture->innings()->doesntExist()) {
            $validated = $request->validate([
                'bats_first' => ['required', Rule::in(['us', 'them'])],
            ]);

            $teamId = $fixture->season->team_id;

            if ($validated['bats_first'] === 'us') {
                $fixture->update(['first_innings_team_id' => $teamId]);

                Innings::create([
                    'fixture_id' => $fixture->id,
                    'batting_team_id' => $teamId,
                    'sequence' => 1,
                ]);

                Innings::create([
                    'fixture_id' => $fixture->id,
                    'batting_team_id' => null,
                    'sequence' => 2,
                ]);
            } else {
                $fixture->update(['first_innings_team_id' => null]);

                Innings::create([
                    'fixture_id' => $fixture->id,
                    'batting_team_id' => null,
                    'sequence' => 1,
                ]);

                Innings::create([
                    'fixture_id' => $fixture->id,
                    'batting_team_id' => $teamId,
                    'sequence' => 2,
                ]);
            }
        }

        $innings = $fixture->innings()->orderBy('sequence')->firstOrFail();

        return redirect("/innings/{$innings->id}/score");
    }

    /**
     * Show the scoring screen for an innings.
     */
    public function show(Innings $innings): Response
    {
        $innings->load(['fixture.season.team', 'fixture.selections.player']);

        $fixture = $innings->fixture;
        $state = app(ScoringService::class)->state($innings);

        $recent = $innings->deliveries()
            ->latest('id')
            ->take(8)
            ->get()
            ->map(fn ($delivery) => [
                'id' => $delivery->id,
                'over_no' => $delivery->over_no,
                'ball_no' => $delivery->ball_no,
                'runs' => $delivery->runs,
                'is_out' => $delivery->is_out,
                'extra_type' => $delivery->extra_type,
                'striker_id' => $delivery->striker_id,
                'bowler_id' => $delivery->bowler_id,
            ]);

        $players = $fixture->selections
            ->map(fn ($selection) => $selection->player)
            ->sortBy('squad_number')
            ->values()
            ->map(fn (Player $player) => $player->only(['id', 'name', 'squad_number']));

        return Inertia::render('scoring/index', [
            'innings' => [
                'id' => $innings->id,
                'batting_team_id' => $innings->batting_team_id,
                'batting_side' => $innings->isOurs() ? 'us' : 'them',
                'sequence' => $innings->sequence,
            ],
            'fixture' => $fixture->only([
                'id',
                'opponent',
                'overs',
                'balls_per_over',
                'track_bowling_wickets',
            ]),
            'team' => $fixture->season->team->only(['id', 'name']),
            'isOurs' => $innings->isOurs(),
            'players' => $players,
            'state' => $state,
            'recent' => $recent,
        ]);
    }

    /**
     * Record a delivery for an innings.
     */
    public function record(Request $request, Innings $innings, ScoringService $scoringService): RedirectResponse
    {
        if ($innings->isOurs()) {
            $validated = $request->validate([
                'striker_id' => ['required', 'exists:players,id'],
                'runs' => ['required', 'integer', 'min:-5', 'max:20'],
                'is_out' => ['boolean'],
                'extra_type' => ['nullable', 'in:wide,no_ball'],
            ]);
        } else {
            $validated = $request->validate([
                'bowler_id' => ['required', 'exists:players,id'],
                'runs' => ['required', 'integer', 'min:-5', 'max:20'],
                'is_out' => ['boolean'],
                'extra_type' => ['nullable', 'in:wide,no_ball'],
            ]);
        }

        $scoringService->record($innings, $validated);

        return redirect("/innings/{$innings->id}/score");
    }

    /**
     * Undo the last delivery for an innings.
     */
    public function undo(Innings $innings, ScoringService $scoringService): RedirectResponse
    {
        $scoringService->undoLast($innings);

        return redirect("/innings/{$innings->id}/score");
    }

    /**
     * Mark an innings as complete.
     */
    public function complete(Innings $innings): RedirectResponse
    {
        $innings->completed_at = now();
        $innings->save();

        return redirect("/innings/{$innings->id}/score");
    }

    /**
     * Reopen a completed innings.
     */
    public function reopen(Innings $innings): RedirectResponse
    {
        $innings->completed_at = null;
        $innings->save();

        return redirect("/innings/{$innings->id}/score");
    }
}
