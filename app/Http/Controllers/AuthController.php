<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\HistorialPersona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Registro de nuevo usuario
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100|unique:usuario,nombre',
            'password' => 'required|string|min:6',
            'region' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'mensaje' => $validator->errors()->first()
            ], 422);
        }

        try {
            $user = User::create([
                'nombre' => $request->nombre,
                'contraseña' => $request->password, // Sin hash como en tu código original
                'icono' => $request->icono ? 'assets/portraits/' . $request->icono : 'assets/portraits/default.png',
                'region' => $request->region ?? 'Unknown',
                'activo' => false,
            ]);

            // Crear historial vacío
            HistorialPersona::create([
                'id_usuario' => $user->id_usuario,
                'partidas_ganadas' => 0,
                'partidas_perdidas' => 0,
                'partidas_totales' => 0,
            ]);

            return response()->json([
                'success' => true,
                'mensaje' => 'Usuario registrado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Error al registrar usuario'
            ], 500);
        }
    }

    /**
     * Login
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Por favor completa todos los campos'
            ], 422);
        }

        $user = User::where('nombre', $request->nombre)
                    ->where('contraseña', $request->password)
                    ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'mensaje' => 'Usuario o contraseña incorrectos'
            ], 401);
        }

        // Marcar como activo
        $user->update(['activo' => true]);

        // Crear sesión
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'user' => $user->nombre,
            'icono' => $user->icono
        ]);
    }

    /**
     * Verificar sesión
     */
    public function verify(Request $request)
    {
        if (Auth::check()) {
            $user = Auth::user();
            return response()->json([
                'logueado' => true,
                'user' => [
                    'nombre' => $user->nombre,
                    'icono' => $user->icono
                ]
            ]);
        }

        return response()->json(['logueado' => false]);
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        if (Auth::check()) {
            $user = Auth::user();
            $user->update(['activo' => false]);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'mensaje' => 'Sesión cerrada'
        ]);
    }
}