<?php

use App\Http\Controllers\FixtureController;
use App\Http\Controllers\PlayerController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('players', [PlayerController::class, 'index'])->name('players.index');
    Route::get('fixtures', [FixtureController::class, 'index'])->name('fixtures.index');
    Route::get('fixtures/create', [FixtureController::class, 'create'])->name('fixtures.create');
    Route::post('fixtures', [FixtureController::class, 'store'])->name('fixtures.store');
});

require __DIR__.'/settings.php';
