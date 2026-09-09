<?php

use App\Http\Controllers\FixtureController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\PlayerController;
use App\Http\Controllers\ScoringController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('players', [PlayerController::class, 'index'])->name('players.index');
    Route::get('fixtures', [FixtureController::class, 'index'])->name('fixtures.index');
    Route::get('fixtures/create', [FixtureController::class, 'create'])->name('fixtures.create');
    Route::post('fixtures', [FixtureController::class, 'store'])->name('fixtures.store');
    Route::get('fixtures/{fixture}/selection', [FixtureController::class, 'selection'])->name('fixtures.selection');
    Route::post('fixtures/{fixture}/selection', [FixtureController::class, 'storeSelection'])->name('fixtures.selection.store');
    Route::get('fixtures/{fixture}/pairs', [FixtureController::class, 'pairs'])->name('fixtures.pairs');
    Route::post('fixtures/{fixture}/pairs', [FixtureController::class, 'storePairs'])->name('fixtures.pairs.store');
    Route::get('fixtures/{fixture}/match', [MatchController::class, 'show'])->name('fixtures.match');
    Route::post('fixtures/{fixture}/score', [ScoringController::class, 'start'])->name('scoring.start');
    Route::get('innings/{innings}/score', [ScoringController::class, 'show'])->name('scoring.show');
    Route::post('innings/{innings}/deliveries', [ScoringController::class, 'record'])->name('scoring.record');
    Route::post('innings/{innings}/undo', [ScoringController::class, 'undo'])->name('scoring.undo');
    Route::post('innings/{innings}/complete', [ScoringController::class, 'complete'])->name('scoring.complete');
    Route::post('innings/{innings}/reopen', [ScoringController::class, 'reopen'])->name('scoring.reopen');
});

require __DIR__.'/settings.php';
