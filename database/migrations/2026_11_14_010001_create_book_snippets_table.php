<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('book_snippets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('page');
            $table->string('kind', 20)->default('code');
            $table->string('language', 30)->nullable();
            $table->text('text');
            $table->string('section')->nullable();
            $table->timestamps();

            $table->index(['book_id', 'page']);
            $table->index(['book_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('book_snippets');
    }
};
