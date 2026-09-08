<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFixtureRequest;
use App\Models\Fixture;
use App\Models\Season;
use Illuminate\Http\RedirectResponse;
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
}
