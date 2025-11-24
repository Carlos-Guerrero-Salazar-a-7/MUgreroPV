<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla para registrar partidas activas y su historial
     */
    public function up(): void
    {
        Schema::create('partidas', function (Blueprint $table) {
            $table->id('id_partida');
            
            // Identificación de la sala
            $table->string('room_id', 255)->unique();
            
            // Jugadores
            $table->unsignedBigInteger('id_jugador1')->nullable();
            $table->unsignedBigInteger('id_jugador2')->nullable();
            $table->string('nombre_jugador1', 100);
            $table->string('nombre_jugador2', 100);
            
            // Personajes seleccionados
            $table->string('personaje_jugador1', 50)->nullable();
            $table->string('personaje_jugador2', 50)->nullable();
            
            // Estado de la partida
            $table->enum('estado', ['esperando', 'en_curso', 'finalizada', 'cancelada'])->default('esperando');
            
            // Resultado
            $table->unsignedBigInteger('id_ganador')->nullable();
            $table->string('nombre_ganador', 100)->nullable();
            $table->integer('salud_jugador1_final')->nullable();
            $table->integer('salud_jugador2_final')->nullable();
            $table->integer('tiempo_restante')->nullable(); // En segundos
            
            // Estadísticas de la partida
            $table->integer('duracion_segundos')->nullable();
            $table->integer('golpes_jugador1')->default(0);
            $table->integer('golpes_jugador2')->default(0);
            $table->integer('combos_jugador1')->default(0);
            $table->integer('combos_jugador2')->default(0);
            
            // Espectadores
            $table->integer('numero_espectadores')->default(0);
            
            // Información técnica
            $table->string('server_id', 100)->nullable(); // ID del servidor Socket.io
            $table->string('ip_host', 45)->nullable();
            
            // Timestamps
            $table->timestamp('inicio_partida')->nullable();
            $table->timestamp('fin_partida')->nullable();
            $table->timestamps();
            
            // Índices
            $table->index(['estado', 'created_at']);
            $table->index('room_id');
            $table->index(['id_jugador1', 'id_jugador2']);
            
            // Foreign keys
            $table->foreign('id_jugador1')->references('id_usuario')->on('usuario')->onDelete('set null');
            $table->foreign('id_jugador2')->references('id_usuario')->on('usuario')->onDelete('set null');
            $table->foreign('id_ganador')->references('id_usuario')->on('usuario')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partidas');
    }
};