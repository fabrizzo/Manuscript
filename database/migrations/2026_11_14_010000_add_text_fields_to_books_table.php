<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->string('text_status', 20)->default('pending');
            $table->timestamp('text_indexed_at')->nullable();
            $table->unsignedInteger('snippets_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn(['text_status', 'text_indexed_at', 'snippets_count']);
        });
    }
};
