<?php

namespace App\Http\Controllers;

use App\Models\Sala;
use App\Models\Partida;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class RoomController extends Controller
{
    /**
     * Listar todas las salas disponibles
     */
    public function index(Request $request)
    {
        $query = Sala::with('host')->activas();

        // Filtros opcionales
        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->has('region')) {
            $query->porRegion($request->region);
        }

        if ($request->has('disponibles')) {
            $query->disponibles();
        }

        $salas = $query->orderBy('ultima_actividad', 'desc')
                      ->paginate(20);

        return response()->json([
            'success' => true,
            'salas' => $salas
        ]);
    }

    /**
     * Crear una nueva sala
     */
    public function store(Request $request)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no autenticado'
            ], 401);
        }

        $validated = $request->validate([
            'nombre_sala' => 'nullable|string|max:100',
            'tipo' => 'required|in:publica,privada,ranked,torneo,entrenamiento',
            'max_espectadores' => 'nullable|integer|min:0|max:50',
            'tiempo_limite' => 'nullable|integer|min:30|max:300',
            'permite_espectadores' => 'nullable|boolean',
            'password' => 'nullable|string|min:4|max:50',
            'descripcion' => 'nullable|string|max:500',
        ]);

        $user = Auth::user();
        $roomId = 'room_' . $user->nombre . '_' . time() . '_' . rand(1000, 9999);

        $sala = Sala::create([
            'room_id' => $roomId,
            'nombre_sala' => $validated['nombre_sala'] ?? "{$user->nombre}'s Room",
            'tipo' => $validated['tipo'],
            'id_host' => $user->id_usuario,
            'nombre_host' => $user->nombre,
            'max_espectadores' => $validated['max_espectadores'] ?? 10,
            'tiempo_limite' => $validated['tiempo_limite'] ?? 99,
            'permite_espectadores' => $validated['permite_espectadores'] ?? true,
            'password' => isset($validated['password']) ? Hash::make($validated['password']) : null,
            'region' => $user->region,
            'descripcion' => $validated['descripcion'] ?? null,
            'estado' => 'abierta',
            'jugadores_actuales' => 1,
            'abierta_en' => now(),
            'ultima_actividad' => now(),
        ]);

        return response()->json([
            'success' => true,
            'mensaje' => 'Sala creada exitosamente',
            'sala' => $sala,
            'room_id' => $roomId
        ]);
    }

    /**
     * Obtener información de una sala específica
     */
    public function show($roomId)
    {
        $sala = Sala::with(['host', 'partida'])->where('room_id', $roomId)->first();

        if (!$sala) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Sala no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'sala' => $sala
        ]);
    }

    /**
     * Unirse a una sala
     */
    public function join(Request $request, $roomId)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no autenticado'
            ], 401);
        }

        $sala = Sala::where('room_id', $roomId)->first();

        if (!$sala) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Sala no encontrada'
            ], 404);
        }

        // Verificar si la sala está llena
        if ($sala->estaLlena()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'La sala está llena'
            ], 403);
        }

        // Verificar password si es necesario
        if ($sala->tienePassword()) {
            $request->validate(['password' => 'required|string']);
            
            if (!$sala->verificarPassword($request->password)) {
                return response()->json([
                    'success' => false,
                    'mensaje' => 'Contraseña incorrecta'
                ], 403);
            }
        }

        // Agregar jugador
        $sala->agregarJugador();

        return response()->json([
            'success' => true,
            'mensaje' => 'Te has unido a la sala',
            'sala' => $sala
        ]);
    }

    /**
     * Salir de una sala
     */
    public function leave($roomId)
    {
        $sala = Sala::where('room_id', $roomId)->first();

        if (!$sala) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Sala no encontrada'
            ], 404);
        }

        $sala->removerJugador();

        return response()->json([
            'success' => true,
            'mensaje' => 'Has salido de la sala'
        ]);
    }

    /**
     * Cerrar una sala (solo el host)
     */
    public function destroy(Request $request, $roomId)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no autenticado'
            ], 401);
        }

        $sala = Sala::where('room_id', $roomId)->first();

        if (!$sala) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Sala no encontrada'
            ], 404);
        }

        // Verificar que el usuario es el host
        if ($sala->id_host !== Auth::id()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Solo el host puede cerrar la sala'
            ], 403);
        }

        $sala->cerrar();

        return response()->json([
            'success' => true,
            'mensaje' => 'Sala cerrada exitosamente'
        ]);
    }

    /**
     * Obtener salas recomendadas para el usuario
     */
    public function recommended()
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario no autenticado'
            ], 401);
        }

        $user = Auth::user();
        $salas = Sala::salasRecomendadas($user);

        return response()->json([
            'success' => true,
            'salas' => $salas
        ]);
    }

    /**
     * Limpiar salas inactivas (para llamar desde cron o comando)
     */
    public function cleanup()
    {
        $limpiadas = Sala::limpiarInactivas();

        return response()->json([
            'success' => true,
            'mensaje' => "Se limpiaron {$limpiadas} salas inactivas"
        ]);
    }
}