<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFixtureRequest;
use App\Models\Fixture;
use App\Models\Player;
use App\Models\Season;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FixtureController extends Controller
{
    /**
     * Display a listing of fixtures.
     */
    public function index(): Response
    {
        return Inertia::render('fixtures/index', [
            'fixtures' => Fixture::with('season')
                ->orderByRaw('played_at IS NULL, played_at DESC')
                ->get(),
        ]);
    }

    /**
     * Show the form for creating a new fixture.
     */
    public function create(): Response
    {
        return Inertia::render('fixtures/create');
    }

    /**
     * Store a newly created fixture.
     */
    public function store(StoreFixtureRequest $request): RedirectResponse
    {
        Fixture::create([
            ...$request->validated(),
            'season_id' => Season::latest()->first()->id,
            'status' => 'scheduled',
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Fixture created.')]);

        return redirect()->route('fixtures.index');
    }

    /**
     * Show the player selection screen for a fixture.
     */
    public function selection(Fixture $fixture): Response
    {
        return Inertia::render('fixtures/selection', [
            'fixture' => $fixture->only('id', 'opponent', 'venue', 'overs'),
            'players' => Player::orderBy('squad_number')->get(['id', 'name', 'squad_number']),
            'selectedIds' => $fixture->selections()->pluck('player_id'),
        ]);
    }

    /**
     * Store the player selection for a fixture.
     */
    public function storeSelection(Request $request, Fixture $fixture): RedirectResponse
    {
        $validated = $request->validate([
            'player_ids' => ['array'],
            'player_ids.*' => ['exists:players,id'],
        ]);

        $fixture->selections()->delete();

        $fixture->selections()->createMany(
            collect($validated['player_ids'] ?? [])
                ->map(fn ($playerId) => ['player_id' => $playerId])
                ->all()
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Selection saved.')]);

        return redirect()->route('fixtures.index');
    }
}
