<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Sala;
use App\Models\Partida;
use Carbon\Carbon;

class CleanupInactiveRooms extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'game:cleanup 
                            {--minutes=10 : Minutos de inactividad antes de limpiar}
                            {--dry-run : Mostrar qué se limpiaría sin hacer cambios}';

    /**
     * The console command description.
     */
    protected $description = 'Limpia salas y partidas inactivas de la base de datos';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $minutes = $this->option('minutes');
        $dryRun = $this->option('dry-run');

        $this->info("🧹 Iniciando limpieza de salas y partidas inactivas...");
        $this->info("⏱️  Inactividad: {$minutes} minutos");
        
        if ($dryRun) {
            $this->warn("🔍 Modo DRY-RUN: No se realizarán cambios");
        }

        // Limpiar salas inactivas
        $salasInactivas = Sala::where('ultima_actividad', '<', now()->subMinutes($minutes))
                              ->whereIn('estado', ['abierta', 'llena'])
                              ->get();

        $this->info("\n📊 Salas encontradas: {$salasInactivas->count()}");

        if ($salasInactivas->count() > 0 && !$dryRun) {
            foreach ($salasInactivas as $sala) {
                $sala->update([
                    'estado' => 'cerrada',
                    'cerrada_en' => now()
                ]);
            }
            $this->info("✅ Salas limpiadas: {$salasInactivas->count()}");
        } elseif ($salasInactivas->count() > 0) {
            $this->table(
                ['Room ID', 'Host', 'Estado', 'Última Actividad'],
                $salasInactivas->map(function ($sala) {
                    return [
                        $sala->room_id,
                        $sala->nombre_host,
                        $sala->estado,
                        $sala->ultima_actividad->diffForHumans()
                    ];
                })->toArray()
            );
        }

        // Cancelar partidas abandonadas
        $partidasAbandonadas = Partida::whereIn('estado', ['esperando', 'en_curso'])
                                      ->where('updated_at', '<', now()->subMinutes($minutes))
                                      ->get();

        $this->info("\n🎮 Partidas abandonadas encontradas: {$partidasAbandonadas->count()}");

        if ($partidasAbandonadas->count() > 0 && !$dryRun) {
            foreach ($partidasAbandonadas as $partida) {
                $partida->cancelar();
            }
            $this->info("✅ Partidas canceladas: {$partidasAbandonadas->count()}");
        } elseif ($partidasAbandonadas->count() > 0) {
            $this->table(
                ['Room ID', 'Jugador 1', 'Jugador 2', 'Estado', 'Última Actualización'],
                $partidasAbandonadas->map(function ($partida) {
                    return [
                        $partida->room_id,
                        $partida->nombre_jugador1,
                        $partida->nombre_jugador2,
                        $partida->estado,
                        $partida->updated_at->diffForHumans()
                    ];
                })->toArray()
            );
        }

        // Limpiar usuarios marcados como activos pero inactivos
        $usuariosInactivos = \App\Models\User::where('activo', true)
                                             ->where('updated_at', '<', now()->subMinutes($minutes))
                                             ->get();

        $this->info("\n👥 Usuarios inactivos encontrados: {$usuariosInactivos->count()}");

        if ($usuariosInactivos->count() > 0 && !$dryRun) {
            foreach ($usuariosInactivos as $usuario) {
                $usuario->update(['activo' => false]);
            }
            $this->info("✅ Usuarios marcados como inactivos: {$usuariosInactivos->count()}");
        }

        if (!$dryRun) {
            $this->info("\n✨ Limpieza completada exitosamente!");
        } else {
            $this->warn("\n🔍 Limpieza simulada completada. Ejecuta sin --dry-run para aplicar cambios.");
        }

        return 0;
    }
}
