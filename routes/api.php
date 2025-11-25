<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\RoomController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Estas rutas se cargan con el prefijo /api automáticamente
| Ejemplo: /auth/login se convierte en /api/auth/login
*/

// ============================================
// RUTAS DE AUTENTICACIÓN (Públicas)
// ============================================
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/verify', [AuthController::class, 'verify']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

// ============================================
// RUTAS DE JUEGO (Requieren autenticación web)
// ============================================
Route::middleware(['web'])->prefix('game')->group(function () {
    Route::get('/active-users', [GameController::class, 'getActiveUsers']);
    Route::post('/match-result', [GameController::class, 'saveMatchResult']);
    Route::get('/user-stats/{nombre}', [GameController::class, 'getUserStats']);
});

// ============================================
// RUTAS DE PARTIDAS (Para Node.js Socket Server)
// ============================================
Route::prefix('matches')->group(function () {
    // Crear partida
    Route::post('/', [MatchController::class, 'store']);
    
    // Iniciar partida
    Route::post('/{roomId}/start', [MatchController::class, 'start']);
    
    // Finalizar partida
    Route::post('/{roomId}/finish', [MatchController::class, 'finish']);
    
    // Cancelar partida
    Route::post('/{roomId}/cancel', [MatchController::class, 'cancel']);
    
    // Obtener información de una partida
    Route::get('/{roomId}', [MatchController::class, 'show']);
    
    // Listar partidas activas
    Route::get('/active/all', [MatchController::class, 'activas']);
    
    // Listar partidas en curso (para espectadores)
    Route::get('/ongoing/all', [MatchController::class, 'enCurso']);
    
    // Historial de partidas de un jugador
    Route::get('/history/{nombreUsuario}', [MatchController::class, 'historial']);
    
    // Estadísticas de un jugador
    Route::get('/stats/{nombreUsuario}', [MatchController::class, 'estadisticas']);
});

// ============================================
// RUTAS DE SALAS (Opcional - para futuro)
// ============================================
Route::middleware(['web'])->prefix('rooms')->group(function () {
    // Listar salas
    Route::get('/', [RoomController::class, 'index']);
    
    // Crear sala
    Route::post('/', [RoomController::class, 'store']);
    
    // Ver sala específica
    Route::get('/{roomId}', [RoomController::class, 'show']);
    
    // Unirse a sala
    Route::post('/{roomId}/join', [RoomController::class, 'join']);
    
    // Salir de sala
    Route::post('/{roomId}/leave', [RoomController::class, 'leave']);
    
    // Cerrar sala
    Route::delete('/{roomId}', [RoomController::class, 'destroy']);
    
    // Salas recomendadas
    Route::get('/recommended/all', [RoomController::class, 'recommended']);
    
    // Limpiar salas inactivas
    Route::post('/cleanup/inactive', [RoomController::class, 'cleanup']);
});