<?php

namespace App\Http\Controllers;

use App\Models\Partida;
use App\Models\User;
use App\Models\HistorialPersona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MatchController extends Controller
{
    /**
     * Crear registro de nueva partida
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_id' => 'required|string|unique:partidas,room_id',
            'nombre_jugador1' => 'required|string',
            'nombre_jugador2' => 'required|string',
            'personaje_jugador1' => 'nullable|string',
            'personaje_jugador2' => 'nullable|string',
        ]);

        // Buscar IDs de los jugadores
        $jugador1 = User::where('nombre', $validated['nombre_jugador1'])->first();
        $jugador2 = User::where('nombre', $validated['nombre_jugador2'])->first();

        $partida = Partida::create([
            'room_id' => $validated['room_id'],
            'id_jugador1' => $jugador1?->id_usuario,
            'id_jugador2' => $jugador2?->id_usuario,
            'nombre_jugador1' => $validated['nombre_jugador1'],
            'nombre_jugador2' => $validated['nombre_jugador2'],
            'personaje_jugador1' => $validated['personaje_jugador1'] ?? 'Ryu',
            'personaje_jugador2' => $validated['personaje_jugador2'] ?? 'Ken',
            'estado' => 'esperando',
        ]);

        return response()->json([
            'success' => true,
            'mensaje' => 'Partida creada',
            'partida' => $partida
        ]);
    }

    /**
     * Iniciar una partida
     */
    public function start($roomId)
    {
        $partida = Partida::where('room_id', $roomId)->first();

        if (!$partida) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Partida no encontrada'
            ], 404);
        }

        if ($partida->estado !== 'esperando') {
            return response()->json([
                'success' => false,
                'mensaje' => 'La partida ya fue iniciada'
            ], 400);
        }

        $partida->iniciar();

        return response()->json([
            'success' => true,
            'mensaje' => 'Partida iniciada',
            'partida' => $partida
        ]);
    }

    /**
     * Finalizar una partida y actualizar estadísticas
     */
    public function finish(Request $request, $roomId)
    {
        $validated = $request->validate([
            'nombre_ganador' => 'required|string',
            'salud_jugador1_final' => 'nullable|integer',
            'salud_jugador2_final' => 'nullable|integer',
            'tiempo_restante' => 'nullable|integer',
            'golpes_jugador1' => 'nullable|integer',
            'golpes_jugador2' => 'nullable|integer',
            'combos_jugador1' => 'nullable|integer',
            'combos_jugador2' => 'nullable|integer',
        ]);

        $partida = Partida::where('room_id', $roomId)->first();

        if (!$partida) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Partida no encontrada'
            ], 404);
        }

        // Determinar ganador
        $ganador = User::where('nombre', $validated['nombre_ganador'])->first();

        if (!$ganador) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Ganador no encontrado'
            ], 404);
        }

        // Determinar perdedor
        $nombrePerdedor = ($partida->nombre_jugador1 === $validated['nombre_ganador']) 
            ? $partida->nombre_jugador2 
            : $partida->nombre_jugador1;
        
        $perdedor = User::where('nombre', $nombrePerdedor)->first();

        DB::transaction(function () use ($partida, $ganador, $perdedor, $validated) {
            // Actualizar partida
            $partida->finalizar($ganador->id_usuario, [
                'p1Health' => $validated['salud_jugador1_final'] ?? 0,
                'p2Health' => $validated['salud_jugador2_final'] ?? 0,
                'timeLeft' => $validated['tiempo_restante'] ?? 0,
            ]);

            // Actualizar estadísticas adicionales
            $partida->actualizarEstadisticas([
                'golpes_jugador1' => $validated['golpes_jugador1'] ?? 0,
                'golpes_jugador2' => $validated['golpes_jugador2'] ?? 0,
                'combos_jugador1' => $validated['combos_jugador1'] ?? 0,
                'combos_jugador2' => $validated['combos_jugador2'] ?? 0,
            ]);

            // Actualizar historial del ganador
            if ($ganador->historial) {
                $ganador->historial->increment('partidas_ganadas');
                $ganador->historial->increment('partidas_totales');
            }

            // Actualizar historial del perdedor
            if ($perdedor && $perdedor->historial) {
                $perdedor->historial->increment('partidas_perdidas');
                $perdedor->historial->increment('partidas_totales');
            }
        });

        return response()->json([
            'success' => true,
            'mensaje' => 'Partida finalizada y estadísticas actualizadas',
            'partida' => $partida->fresh()
        ]);
    }

    /**
     * Obtener todas las partidas activas
     */
    public function activas()
    {
        $partidas = Partida::with(['jugador1', 'jugador2'])
                          ->activas()
                          ->orderBy('inicio_partida', 'desc')
                          ->get();

        return response()->json([
            'success' => true,
            'partidas' => $partidas
        ]);
    }

    /**
     * Obtener partidas en curso (para espectadores)
     */
    public function enCurso()
    {
        $partidas = Partida::with(['jugador1', 'jugador2'])
                          ->enCurso()
                          ->orderBy('inicio_partida', 'desc')
                          ->get();

        return response()->json([
            'success' => true,
            'partidas' => $partidas
        ]);
    }

    /**
     * Obtener historial de partidas de un jugador
     */
    public function historial($nombreUsuario)
    {
        $usuario = User::where('nombre', $nombreUsuario)->first();

        if (!$usuario) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no encontrado'
            ], 404);
        }

        $partidas = Partida::with(['jugador1', 'jugador2', 'ganador'])
                          ->delJugador($usuario->id_usuario)
                          ->finalizadas()
                          ->orderBy('fin_partida', 'desc')
                          ->paginate(20);

        return response()->json([
            'success' => true,
            'partidas' => $partidas
        ]);
    }

    /**
     * Obtener estadísticas detalladas de un jugador
     */
    public function estadisticas($nombreUsuario)
    {
        $usuario = User::with('historial')->where('nombre', $nombreUsuario)->first();

        if (!$usuario) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no encontrado'
            ], 404);
        }

        $partidasJugadas = Partida::delJugador($usuario->id_usuario)
                                  ->finalizadas()
                                  ->count();

        $partidasGanadas = Partida::where('id_ganador', $usuario->id_usuario)
                                  ->finalizadas()
                                  ->count();

        $partidasPerdidas = $partidasJugadas - $partidasGanadas;

        // Racha actual
        $ultimasPartidas = Partida::delJugador($usuario->id_usuario)
                                  ->finalizadas()
                                  ->orderBy('fin_partida', 'desc')
                                  ->limit(10)
                                  ->get();

        $rachaActual = 0;
        foreach ($ultimasPartidas as $partida) {
            if ($partida->id_ganador === $usuario->id_usuario) {
                $rachaActual++;
            } else {
                break;
            }
        }

        // Personaje más usado
        $personajeMasUsado = Partida::delJugador($usuario->id_usuario)
                                    ->finalizadas()
                                    ->select(
                                        DB::raw('CASE 
                                            WHEN id_jugador1 = ? THEN personaje_jugador1 
                                            ELSE personaje_jugador2 
                                        END as personaje'),
                                        DB::raw('COUNT(*) as veces')
                                    )
                                    ->setBindings([$usuario->id_usuario])
                                    ->groupBy('personaje')
                                    ->orderBy('veces', 'desc')
                                    ->first();

        return response()->json([
            'success' => true,
            'estadisticas' => [
                'nombre' => $usuario->nombre,
                'partidas_jugadas' => $partidasJugadas,
                'partidas_ganadas' => $partidasGanadas,
                'partidas_perdidas' => $partidasPerdidas,
                'racha_actual' => $rachaActual,
                'personaje_favorito' => $personajeMasUsado?->personaje ?? 'N/A',
                'ratio_victorias' => $partidasJugadas > 0 
                    ? round(($partidasGanadas / $partidasJugadas) * 100, 2) 
                    : 0,
            ]
        ]);
    }

    /**
     * Cancelar una partida
     */
    public function cancel($roomId)
    {
        $partida = Partida::where('room_id', $roomId)->first();

        if (!$partida) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Partida no encontrada'
            ], 404);
        }

        $partida->cancelar();

        return response()->json([
            'success' => true,
            'mensaje' => 'Partida cancelada'
        ]);
    }

    /**
     * Obtener información de una partida específica
     */
    public function show($roomId)
    {
        $partida = Partida::with(['jugador1', 'jugador2', 'ganador'])
                         ->where('room_id', $roomId)
                         ->first();

        if (!$partida) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Partida no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'partida' => $partida
        ]);
    }
}
