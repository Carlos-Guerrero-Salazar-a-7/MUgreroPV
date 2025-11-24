<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class Sala extends Model
{
    use HasFactory;

    protected $table = 'salas';
    protected $primaryKey = 'id_sala';

    protected $fillable = [
        'room_id',
        'nombre_sala',
        'tipo',
        'id_host',
        'nombre_host',
        'max_jugadores',
        'max_espectadores',
        'tiempo_limite',
        'permite_espectadores',
        'password',
        'estado',
        'jugadores_actuales',
        'espectadores_actuales',
        'region',
        'ping_maximo',
        'server_id',
        'server_region',
        'configuracion_extra',
        'descripcion',
        'abierta_en',
        'cerrada_en',
        'ultima_actividad',
    ];

    protected $casts = [
        'max_jugadores' => 'integer',
        'max_espectadores' => 'integer',
        'tiempo_limite' => 'integer',
        'permite_espectadores' => 'boolean',
        'jugadores_actuales' => 'integer',
        'espectadores_actuales' => 'integer',
        'ping_maximo' => 'integer',
        'configuracion_extra' => 'array',
        'abierta_en' => 'datetime',
        'cerrada_en' => 'datetime',
        'ultima_actividad' => 'datetime',
    ];

    // Relaciones
    public function host()
    {
        return $this->belongsTo(User::class, 'id_host', 'id_usuario');
    }

    public function partida()
    {
        return $this->hasOne(Partida::class, 'room_id', 'room_id');
    }

    // Scopes
    public function scopeAbiertas($query)
    {
        return $query->where('estado', 'abierta');
    }

    public function scopePublicas($query)
    {
        return $query->where('tipo', 'publica');
    }

    public function scopePorRegion($query, $region)
    {
        return $query->where('region', $region);
    }

    public function scopeDisponibles($query)
    {
        return $query->where('estado', 'abierta')
                     ->whereColumn('jugadores_actuales', '<', 'max_jugadores');
    }

    public function scopeActivas($query)
    {
        return $query->whereIn('estado', ['abierta', 'llena', 'en_juego'])
                     ->where('ultima_actividad', '>', now()->subMinutes(5));
    }

    // Métodos helper
    public function esPrivada()
    {
        return $this->tipo === 'privada';
    }

    public function tienePassword()
    {
        return !empty($this->password);
    }

    public function verificarPassword($password)
    {
        if (!$this->tienePassword()) {
            return true;
        }
        return Hash::check($password, $this->password);
    }

    public function estaLlena()
    {
        return $this->jugadores_actuales >= $this->max_jugadores;
    }

    public function puedeUnirseEspectador()
    {
        return $this->permite_espectadores && 
               $this->espectadores_actuales < $this->max_espectadores;
    }

    public function agregarJugador()
    {
        $this->increment('jugadores_actuales');
        $this->actualizarActividad();
        
        if ($this->jugadores_actuales >= $this->max_jugadores) {
            $this->update(['estado' => 'llena']);
        }
    }

    public function removerJugador()
    {
        $this->decrement('jugadores_actuales');
        $this->actualizarActividad();
        
        if ($this->jugadores_actuales < $this->max_jugadores && $this->estado === 'llena') {
            $this->update(['estado' => 'abierta']);
        }
        
        // Si no quedan jugadores, cerrar la sala
        if ($this->jugadores_actuales <= 0) {
            $this->cerrar();
        }
    }

    public function agregarEspectador()
    {
        if ($this->puedeUnirseEspectador()) {
            $this->increment('espectadores_actuales');
            $this->actualizarActividad();
            return true;
        }
        return false;
    }

    public function removerEspectador()
    {
        if ($this->espectadores_actuales > 0) {
            $this->decrement('espectadores_actuales');
            $this->actualizarActividad();
        }
    }

    public function iniciarJuego()
    {
        $this->update([
            'estado' => 'en_juego',
            'ultima_actividad' => now()
        ]);
    }

    public function cerrar()
    {
        $this->update([
            'estado' => 'cerrada',
            'cerrada_en' => now()
        ]);
    }

    public function actualizarActividad()
    {
        $this->update(['ultima_actividad' => now()]);
    }

    // Limpiar salas inactivas (método estático)
    public static function limpiarInactivas($minutosInactividad = 10)
    {
        return self::where('ultima_actividad', '<', now()->subMinutes($minutosInactividad))
                   ->whereIn('estado', ['abierta', 'llena'])
                   ->update([
                       'estado' => 'cerrada',
                       'cerrada_en' => now()
                   ]);
    }

    // Obtener salas recomendadas para un usuario
    public static function salasRecomendadas($usuario, $limit = 10)
    {
        return self::disponibles()
                   ->publicas()
                   ->where('region', $usuario->region)
                   ->orderBy('jugadores_actuales', 'desc')
                   ->orderBy('ultima_actividad', 'desc')
                   ->limit($limit)
                   ->get();
    }
}
