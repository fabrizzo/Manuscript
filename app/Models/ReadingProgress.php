<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReadingProgress extends Model
{
    protected $table = 'reading_progress';

    protected $fillable = [
        'book_id',
        'current_page',
    ];

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }
}