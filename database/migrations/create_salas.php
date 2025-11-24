<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla para administración de salas de juego
     */
    public function up(): void
    {
        Schema::create('salas', function (Blueprint $table) {
            $table->id('id_sala');
            
            // Identificación
            $table->string('room_id', 255)->unique();
            $table->string('nombre_sala', 100)->nullable();
            
            // Tipo de sala
            $table->enum('tipo', ['publica', 'privada', 'ranked', 'torneo', 'entrenamiento'])->default('publica');
            
            // Host de la sala
            $table->unsignedBigInteger('id_host');
            $table->string('nombre_host', 100);
            
            // Configuración
            $table->integer('max_jugadores')->default(2);
            $table->integer('max_espectadores')->default(10);
            $table->integer('tiempo_limite')->default(99); // Segundos
            $table->boolean('permite_espectadores')->default(true);
            $table->string('password', 255)->nullable(); // Para salas privadas
            
            // Estado
            $table->enum('estado', ['abierta', 'llena', 'en_juego', 'cerrada'])->default('abierta');
            $table->integer('jugadores_actuales')->default(1);
            $table->integer('espectadores_actuales')->default(0);
            
            // Región y conectividad
            $table->string('region', 50)->default('Global');
            $table->integer('ping_maximo')->nullable(); // ms
            
            // Información del servidor
            $table->string('server_id', 100)->nullable();
            $table->string('server_region', 50)->nullable();
            
            // Metadata
            $table->json('configuracion_extra')->nullable(); // Para configuraciones personalizadas
            $table->text('descripcion')->nullable();
            
            // Control de tiempo
            $table->timestamp('abierta_en')->nullable();
            $table->timestamp('cerrada_en')->nullable();
            $table->timestamp('ultima_actividad')->nullable();
            $table->timestamps();
            
            // Índices
            $table->index(['estado', 'tipo']);
            $table->index('room_id');
            $table->index(['id_host', 'estado']);
            $table->index('region');
            
            // Foreign key
            $table->foreign('id_host')->references('id_usuario')->on('usuario')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salas');
    }
};