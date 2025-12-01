<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\HistorialPersona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

use App\Models\Partida;
use Illuminate\Support\Str;

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
            'p1Name' => 'required|string',
            'p2Name' => 'required|string',
            'p1Char' => 'nullable|string',
            'p2Char' => 'nullable|string',
            'roomID' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'mensaje' => $validator->errors()->first()
            ], 422);
        }

        try {
            // Obtener usuarios
            $winner = User::where('nombre', $request->winner)->first();
            $loser = User::where('nombre', $request->loser)->first();
            $p1 = User::where('nombre', $request->p1Name)->first();
            $p2 = User::where('nombre', $request->p2Name)->first();

            // Actualizar historial del ganador
            if ($winner && $winner->historial) {
                $winner->historial->increment('partidas_ganadas');
                $winner->historial->increment('partidas_totales');
            }

            // Actualizar historial del perdedor
            if ($loser && $loser->historial) {
                $loser->historial->increment('partidas_perdidas');
                $loser->historial->increment('partidas_totales');
            }

            // Crear registro de partida
            Partida::create([
                'room_id' => $request->roomID ?? Str::uuid()->toString(),
                'id_jugador1' => $p1 ? $p1->id_usuario : null,
                'id_jugador2' => $p2 ? $p2->id_usuario : null,
                'nombre_jugador1' => $request->p1Name,
                'nombre_jugador2' => $request->p2Name,
                'personaje_jugador1' => $request->p1Char,
                'personaje_jugador2' => $request->p2Char,
                'estado' => 'finalizada',
                'id_ganador' => $winner ? $winner->id_usuario : null,
                'nombre_ganador' => $request->winner,
                'inicio_partida' => now(),
                'fin_partida' => now(),
            ]);

            return response()->json([
                'success' => true,
                'mensaje' => 'Resultado guardado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Error al guardar resultado: ' . $e->getMessage()
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

        // Obtener últimas 10 partidas
        $lastMatches = Partida::delJugador($user->id_usuario)
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->map(function ($match) use ($user) {
                $isP1 = $match->id_jugador1 === $user->id_usuario;
                $opponentName = $isP1 ? $match->nombre_jugador2 : $match->nombre_jugador1;
                $myChar = $isP1 ? $match->personaje_jugador1 : $match->personaje_jugador2;
                $result = $match->id_ganador === $user->id_usuario ? 'Victoria' : 'Derrota';
                
                return [
                    'opponent' => $opponentName,
                    'character' => $myChar,
                    'result' => $result,
                    'date' => $match->created_at->format('d/m/Y H:i')
                ];
            });

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
                ],
                'history' => $lastMatches
            ]
        ]);
    }
}