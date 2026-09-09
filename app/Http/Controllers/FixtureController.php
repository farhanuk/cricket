<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFixtureRequest;
use App\Models\Fixture;
use App\Models\Player;
use App\Models\Season;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
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

    /**
     * Show the batting pairs screen for a fixture.
     */
    public function pairs(Fixture $fixture): Response
    {
        $selectedPlayerIds = $fixture->selections()->pluck('player_id');

        return Inertia::render('fixtures/pairs', [
            'fixture' => $fixture->only('id', 'opponent'),
            'players' => Player::query()
                ->whereIn('id', $selectedPlayerIds)
                ->orderBy('squad_number')
                ->get(['id', 'name', 'squad_number']),
            'pairs' => $fixture->pairs()
                ->orderBy('position')
                ->get(['id', 'position', 'player_a_id', 'player_b_id']),
        ]);
    }

    /**
     * Store the batting pairs for a fixture.
     */
    public function storePairs(Request $request, Fixture $fixture): RedirectResponse
    {
        $validated = $request->validate([
            'pairs' => ['required', 'array', 'size:4'],
            'pairs.*.position' => ['required', 'integer', 'min:1', 'max:4'],
            'pairs.*.player_a_id' => ['required', 'exists:players,id'],
            'pairs.*.player_b_id' => ['required', 'exists:players,id'],
        ]);

        $allowedPlayerIds = $fixture->selections()->pluck('player_id')->all();

        $playerIds = collect($validated['pairs'])
            ->flatMap(fn (array $pair) => [$pair['player_a_id'], $pair['player_b_id']])
            ->all();

        if (count($playerIds) !== count(array_unique($playerIds))) {
            throw ValidationException::withMessages([
                'pairs' => __('Each player can only appear once across all pairs.'),
            ]);
        }

        foreach ($playerIds as $playerId) {
            if (! in_array($playerId, $allowedPlayerIds)) {
                throw ValidationException::withMessages([
                    'pairs' => __('All players must be from this fixture\'s selection.'),
                ]);
            }
        }

        $fixture->pairs()->delete();

        $fixture->pairs()->createMany(
            collect($validated['pairs'])
                ->map(fn (array $pair) => [
                    'position' => $pair['position'],
                    'player_a_id' => $pair['player_a_id'],
                    'player_b_id' => $pair['player_b_id'],
                ])
                ->all()
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Pairs saved.')]);

        return redirect()->route('fixtures.index');
    }
}
