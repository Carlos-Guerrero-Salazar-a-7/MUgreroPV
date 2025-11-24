<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\HistorialPersona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class GameController extends Controller
{
    /**
     * Obtener todos los usuarios activos excepto el actual
     */
    public function getActiveUsers(Request $request)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no autenticado',
                'users' => []
            ], 401);
        }

        $currentUserId = Auth::id();

        $activeUsers = User::with('historial')
            ->where('id_usuario', '!=', $currentUserId)
            ->where('activo', true)
            ->get()
            ->map(function ($user) {
                return [
                    'nombre' => $user->nombre,
                    'icono' => $user->icono,
                    'region' => $user->region,
                    'victorias' => $user->historial->partidas_ganadas ?? 0,
                ];
            });

        return response()->json([
            'success' => true,
            'message' => 'Active users found.',
            'users' => $activeUsers
        ]);
    }

    /**
     * Registrar resultado de partida
     */
    public function saveMatchResult(Request $request)
    {
        $validator = validator($request->all(), [
            'winner' => 'required|string',
            'loser' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'mensaje' => $validator->errors()->first()
            ], 422);
        }

        try {
            // Actualizar ganador
            $winner = User::where('nombre', $request->winner)->first();
            if ($winner && $winner->historial) {
                $winner->historial->increment('partidas_ganadas');
                $winner->historial->increment('partidas_totales');
            }

            // Actualizar perdedor
            $loser = User::where('nombre', $request->loser)->first();
            if ($loser && $loser->historial) {
                $loser->historial->increment('partidas_perdidas');
                $loser->historial->increment('partidas_totales');
            }

            return response()->json([
                'success' => true,
                'mensaje' => 'Resultado guardado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Error al guardar resultado'
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de un usuario
     */
    public function getUserStats($nombre)
    {
        $user = User::with('historial')
            ->where('nombre', $nombre)
            ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'nombre' => $user->nombre,
                'icono' => $user->icono,
                'region' => $user->region,
                'stats' => [
                    'victorias' => $user->historial->partidas_ganadas ?? 0,
                    'derrotas' => $user->historial->partidas_perdidas ?? 0,
                    'total' => $user->historial->partidas_totales ?? 0,
                ]
            ]
        ]);
    }
}