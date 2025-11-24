<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Rutas de autenticación (públicas)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/auth/verify', [AuthController::class, 'verify']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// Rutas protegidas (requieren autenticación)
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/game/active-users', [GameController::class, 'getActiveUsers']);
    Route::post('/game/match-result', [GameController::class, 'saveMatchResult']);
    Route::get('/game/user-stats/{nombre}', [GameController::class, 'getUserStats']);
});
