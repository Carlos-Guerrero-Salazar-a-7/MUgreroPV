<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistorialPersona extends Model
{
    use HasFactory;

    protected $table = 'historialpersona';
    protected $primaryKey = 'id_historial';

    protected $fillable = [
        'id_usuario',
        'partidas_ganadas',
        'partidas_perdidas',
        'partidas_totales',
    ];

    protected $casts = [
        'partidas_ganadas' => 'integer',
        'partidas_perdidas' => 'integer',
        'partidas_totales' => 'integer',
    ];

    // Relación con usuario
    public function usuario()
    {
        return $this->belongsTo(User::class, 'id_usuario', 'id_usuario');
    }
}