<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\Pair;
use App\Models\Player;
use App\Models\Selection;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlayerController extends Controller
{
    /**
     * Display a listing of players.
     */
    public function index(): Response
    {
        return Inertia::render('players/index', [
            'players' => Player::orderBy('name')->get(['id', 'name', 'squad_number', 'active']),
        ]);
    }

    /**
     * Store a newly created player.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'squad_number' => ['nullable', 'integer', 'min:0', 'max:999'],
            'active' => ['boolean'],
        ]);

        $team = Team::query()->firstOrFail();

        Player::create([
            ...$validated,
            'team_id' => $team->id,
            'active' => $validated['active'] ?? true,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Player created.')]);

        return redirect()->route('players.index');
    }

    /**
     * Update the given player.
     */
    public function update(Request $request, Player $player): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'squad_number' => ['nullable', 'integer', 'min:0', 'max:999'],
            'active' => ['boolean'],
        ]);

        $player->update([
            ...$validated,
            'active' => $validated['active'] ?? false,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Player updated.')]);

        return redirect()->back();
    }

    /**
     * Remove the given player, or deactivate if they have match history.
     */
    public function destroy(Player $player): RedirectResponse
    {
        if ($this->hasMatchHistory($player)) {
            $player->update(['active' => false]);

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => __('Player deactivated because they have match history.'),
            ]);

            return redirect()->back();
        }

        $player->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Player deleted.')]);

        return redirect()->back();
    }

    protected function hasMatchHistory(Player $player): bool
    {
        if (Delivery::query()
            ->where(function ($query) use ($player) {
                $query->where('striker_id', $player->id)
                    ->orWhere('bowler_id', $player->id);
            })
            ->exists()) {
            return true;
        }

        if (Selection::query()->where('player_id', $player->id)->exists()) {
            return true;
        }

        return Pair::query()
            ->where(function ($query) use ($player) {
                $query->where('player_a_id', $player->id)
                    ->orWhere('player_b_id', $player->id);
            })
            ->exists();
    }
}
