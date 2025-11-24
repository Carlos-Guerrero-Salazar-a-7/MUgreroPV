<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Partida extends Model
{
    use HasFactory;

    protected $table = 'partidas';
    protected $primaryKey = 'id_partida';

    protected $fillable = [
        'room_id',
        'id_jugador1',
        'id_jugador2',
        'nombre_jugador1',
        'nombre_jugador2',
        'personaje_jugador1',
        'personaje_jugador2',
        'estado',
        'id_ganador',
        'nombre_ganador',
        'salud_jugador1_final',
        'salud_jugador2_final',
        'tiempo_restante',
        'duracion_segundos',
        'golpes_jugador1',
        'golpes_jugador2',
        'combos_jugador1',
        'combos_jugador2',
        'numero_espectadores',
        'server_id',
        'ip_host',
        'inicio_partida',
        'fin_partida',
    ];

    protected $casts = [
        'salud_jugador1_final' => 'integer',
        'salud_jugador2_final' => 'integer',
        'tiempo_restante' => 'integer',
        'duracion_segundos' => 'integer',
        'golpes_jugador1' => 'integer',
        'golpes_jugador2' => 'integer',
        'combos_jugador1' => 'integer',
        'combos_jugador2' => 'integer',
        'numero_espectadores' => 'integer',
        'inicio_partida' => 'datetime',
        'fin_partida' => 'datetime',
    ];

    // Relaciones
    public function jugador1()
    {
        return $this->belongsTo(User::class, 'id_jugador1', 'id_usuario');
    }

    public function jugador2()
    {
        return $this->belongsTo(User::class, 'id_jugador2', 'id_usuario');
    }

    public function ganador()
    {
        return $this->belongsTo(User::class, 'id_ganador', 'id_usuario');
    }

    // Scopes
    public function scopeActivas($query)
    {
        return $query->whereIn('estado', ['esperando', 'en_curso']);
    }

    public function scopeFinalizadas($query)
    {
        return $query->where('estado', 'finalizada');
    }

    public function scopeEnCurso($query)
    {
        return $query->where('estado', 'en_curso');
    }

    public function scopeDelJugador($query, $idUsuario)
    {
        return $query->where(function($q) use ($idUsuario) {
            $q->where('id_jugador1', $idUsuario)
              ->orWhere('id_jugador2', $idUsuario);
        });
    }

    // Métodos helper
    public function esJugador($idUsuario)
    {
        return $this->id_jugador1 === $idUsuario || $this->id_jugador2 === $idUsuario;
    }

    public function iniciar()
    {
        $this->update([
            'estado' => 'en_curso',
            'inicio_partida' => now()
        ]);
    }

    public function finalizar($ganadorId, $estadoFinal = [])
    {
        $ganador = User::find($ganadorId);
        
        $duracion = null;
        if ($this->inicio_partida) {
            $duracion = now()->diffInSeconds($this->inicio_partida);
        }

        $this->update([
            'estado' => 'finalizada',
            'id_ganador' => $ganadorId,
            'nombre_ganador' => $ganador ? $ganador->nombre : null,
            'salud_jugador1_final' => $estadoFinal['p1Health'] ?? null,
            'salud_jugador2_final' => $estadoFinal['p2Health'] ?? null,
            'tiempo_restante' => $estadoFinal['timeLeft'] ?? null,
            'duracion_segundos' => $duracion,
            'fin_partida' => now()
        ]);
    }

    public function cancelar()
    {
        $this->update([
            'estado' => 'cancelada',
            'fin_partida' => now()
        ]);
    }

    public function actualizarEstadisticas($stats)
    {
        $this->update([
            'golpes_jugador1' => $stats['golpes_jugador1'] ?? $this->golpes_jugador1,
            'golpes_jugador2' => $stats['golpes_jugador2'] ?? $this->golpes_jugador2,
            'combos_jugador1' => $stats['combos_jugador1'] ?? $this->combos_jugador1,
            'combos_jugador2' => $stats['combos_jugador2'] ?? $this->combos_jugador2,
            'numero_espectadores' => $stats['espectadores'] ?? $this->numero_espectadores,
        ]);
    }

    // Obtener el oponente de un jugador
    public function getOponente($idUsuario)
    {
        if ($this->id_jugador1 === $idUsuario) {
            return $this->jugador2;
        }
        return $this->jugador1;
    }
}