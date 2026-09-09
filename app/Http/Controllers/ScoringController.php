<?php

namespace App\Http\Controllers;

use App\Models\Fixture;
use App\Models\Innings;
use App\Services\ScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScoringController extends Controller
{
    /**
     * Start or resume us batting for a fixture.
     */
    public function start(Fixture $fixture): RedirectResponse
    {
        $innings = Innings::firstOrCreate(
            [
                'fixture_id' => $fixture->id,
                'batting_side' => 'us',
                'sequence' => 1,
            ],
        );

        return redirect("/innings/{$innings->id}/score");
    }

    /**
     * Show the scoring screen for an innings.
     */
    public function show(Innings $innings): Response
    {
        $innings->load('fixture');

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
            ]);

        return Inertia::render('scoring/index', [
            'innings' => $innings->only('id', 'batting_side', 'sequence'),
            'fixture' => $innings->fixture->only('id', 'opponent', 'overs', 'balls_per_over'),
            'state' => $state,
            'recent' => $recent,
        ]);
    }

    /**
     * Record a delivery for an innings.
     */
    public function record(Request $request, Innings $innings, ScoringService $scoringService): RedirectResponse
    {
        $validated = $request->validate([
            'striker_id' => ['required', 'exists:players,id'],
            'runs' => ['required', 'integer', 'min:-5', 'max:20'],
            'is_out' => ['boolean'],
            'extra_type' => ['nullable', 'in:wide,no_ball'],
        ]);

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
