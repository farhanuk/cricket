<?php

namespace App\Http\Controllers;

use App\Models\Player;
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
            'players' => Player::orderBy('squad_number')->get(['id', 'name', 'squad_number', 'active']),
        ]);
    }
}
