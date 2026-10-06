<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->json('pdf_metadata')->nullable()->after('description');
            $table->unsignedBigInteger('file_size')->nullable()->after('original_name');
        });
    }

    public function down(): void
    {
        Schema::table('books', function (Blueprint $table) {
            $table->dropColumn(['pdf_metadata', 'file_size']);
        });
    }
};