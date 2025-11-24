<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('game');
})->name('home');

// Rutas de autenticación usando sesiones web
Route::post('/auth/register', [AuthController::class, 'register'])->name('auth.register');
Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
Route::get('/auth/verify', [AuthController::class, 'verify'])->name('auth.verify');
Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

// Rutas de juego
Route::middleware(['web'])->group(function () {
    Route::get('/game/active-users', [GameController::class, 'getActiveUsers'])->name('game.active-users');
    Route::post('/game/match-result', [GameController::class, 'saveMatchResult'])->name('game.match-result');
    Route::get('/game/user-stats/{nombre}', [GameController::class, 'getUserStats'])->name('game.user-stats');
});
