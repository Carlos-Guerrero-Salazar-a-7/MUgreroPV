<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\RoomController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| Estas rutas usan sesiones web y CSRF token
*/

// Página principal
Route::get('/', function () {
    return view('game');
})->name('home');

// ============================================
// RUTAS DE AUTENTICACIÓN (Web)
// ============================================
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    Route::get('/verify', [AuthController::class, 'verify'])->name('auth.verify');
    Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
});

// ============================================
// RUTAS DE JUEGO (Web)
// ============================================
Route::middleware(['web'])->prefix('game')->group(function () {
    Route::get('/active-users', [GameController::class, 'getActiveUsers'])->name('game.active-users');
    Route::post('/match-result', [GameController::class, 'saveMatchResult'])->name('game.match-result');
    Route::get('/user-stats/{nombre}', [GameController::class, 'getUserStats'])->name('game.user-stats');
});

// ============================================
// RUTAS DE PARTIDAS (Web - Opcional)
// ============================================
Route::prefix('matches')->name('matches.')->group(function () {
    Route::post('/', [MatchController::class, 'store'])->name('store');
    Route::post('/{roomId}/start', [MatchController::class, 'start'])->name('start');
    Route::post('/{roomId}/finish', [MatchController::class, 'finish'])->name('finish');
    Route::post('/{roomId}/cancel', [MatchController::class, 'cancel'])->name('cancel');
    Route::get('/{roomId}', [MatchController::class, 'show'])->name('show');
});

// ============================================
// RUTAS DE SALAS (Web)
// ============================================
Route::middleware(['web'])->prefix('rooms')->name('rooms.')->group(function () {
    Route::get('/', [RoomController::class, 'index'])->name('index');
    Route::post('/', [RoomController::class, 'store'])->name('store');
    Route::get('/{roomId}', [RoomController::class, 'show'])->name('show');
    Route::post('/{roomId}/join', [RoomController::class, 'join'])->name('join');
    Route::post('/{roomId}/leave', [RoomController::class, 'leave'])->name('leave');
    Route::delete('/{roomId}', [RoomController::class, 'destroy'])->name('destroy');
});