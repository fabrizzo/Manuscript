<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->string('kind', 20)->default('idea');
            $table->text('body');
            $table->json('tags')->nullable();
            $table->string('section')->nullable();
            $table->timestamps();

            $table->index(['book_id', 'page']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
