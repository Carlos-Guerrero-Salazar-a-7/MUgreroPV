<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'usuario';
    protected $primaryKey = 'id_usuario';

    protected $fillable = [
        'nombre',
        'contraseña',
        'icono',
        'region',
        'activo',
    ];

    protected $hidden = [
        'contraseña',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    // Relación con historial
    public function historial()
    {
        return $this->hasOne(HistorialPersona::class, 'id_usuario', 'id_usuario');
    }

    // Override para usar 'contraseña' en lugar de 'password'
    public function getAuthPassword()
    {
        return $this->contraseña;
    }

    // Scope para usuarios activos
    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
    