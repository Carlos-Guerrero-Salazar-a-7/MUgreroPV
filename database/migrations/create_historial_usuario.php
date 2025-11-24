<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historialpersona', function (Blueprint $table) {
            $table->id('id_historial');
            $table->unsignedBigInteger('id_usuario');
            $table->integer('partidas_ganadas')->default(0);
            $table->integer('partidas_perdidas')->default(0);
            $table->integer('partidas_totales')->default(0);
            $table->timestamps();

            $table->foreign('id_usuario')
                  ->references('id_usuario')
                  ->on('usuario')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historialpersona');
    }
};
