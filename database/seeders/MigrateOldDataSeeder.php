<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\HistorialPersona;

class MigrateOldDataSeeder extends Seeder
{
    /**
     * Ejecutar para migrar datos de la base antigua a la nueva estructura
     * 
     * NOTA: Solo usar si ya tienes datos en la base de datos con la estructura antigua
     * 
     * Uso: sudo php artisan db:seed --class=MigrateOldDataSeeder
     */
    public function run(): void
    {
        // Verificar si las tablas antiguas existen
        if (!$this->tableExists('usuario_old')) {
            $this->command->info('No se encontró tabla antigua. Creando datos de prueba...');
            $this->createTestData();
            return;
        }

        $this->command->info('Migrando datos de usuarios...');

        // Migrar usuarios
        $oldUsers = DB::table('usuario_old')->get();
        
        foreach ($oldUsers as $oldUser) {
            $user = User::create([
                'nombre' => $oldUser->nombre,
                'contraseña' => $oldUser->contraseña,
                'icono' => $oldUser->icono ?? 'assets/portraits/default.png',
                'region' => $oldUser->region ?? 'Unknown',
                'activo' => false,
                'created_at' => $oldUser->created_at ?? now(),
            ]);

            $this->command->info("Usuario migrado: {$user->nombre}");

            // Migrar historial si existe
            $oldHistorial = DB::table('historialpersona_old')
                ->where('id_usuario', $oldUser->id_usuario)
                ->first();

            if ($oldHistorial) {
                HistorialPersona::create([
                    'id_usuario' => $user->id_usuario,
                    'partidas_ganadas' => $oldHistorial->partidas_ganadas ?? 0,
                    'partidas_perdidas' => $oldHistorial->partidas_perdidas ?? 0,
                    'partidas_totales' => $oldHistorial->partidas_totales ?? 0,
                ]);
            } else {
                // Crear historial vacío
                HistorialPersona::create([
                    'id_usuario' => $user->id_usuario,
                    'partidas_ganadas' => 0,
                    'partidas_perdidas' => 0,
                    'partidas_totales' => 0,
                ]);
            }
        }

        $this->command->info('Migración completada exitosamente!');
    }

    /**
     * Crear datos de prueba
     */
    private function createTestData(): void
    {
        $this->command->info('Creando usuarios de prueba...');

        $users = [
            ['nombre' => 'Ryu', 'contraseña' => 'password', 'icono' => 'assets/portraits/ryu.png', 'region' => 'Japan'],
            ['nombre' => 'Ken', 'contraseña' => 'password', 'icono' => 'assets/portraits/ken.png', 'region' => 'USA'],
            ['nombre' => 'Chun-Li', 'contraseña' => 'password', 'icono' => 'assets/portraits/chun.png', 'region' => 'China'],
            ['nombre' => 'Guile', 'contraseña' => 'password', 'icono' => 'assets/portraits/guile.png', 'region' => 'USA'],
        ];

        foreach ($users as $userData) {
            $user = User::create($userData);

            // Crear historial con datos aleatorios
            HistorialPersona::create([
                'id_usuario' => $user->id_usuario,
                'partidas_ganadas' => rand(0, 20),
                'partidas_perdidas' => rand(0, 20),
                'partidas_totales' => rand(0, 40),
            ]);

            $this->command->info("Usuario de prueba creado: {$user->nombre}");
        }

        $this->command->info('Datos de prueba creados exitosamente!');
    }

    /**
     * Verificar si una tabla existe
     */
    private function tableExists(string $table): bool
    {
        return DB::getSchemaBuilder()->hasTable($table);
    }
}