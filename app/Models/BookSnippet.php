<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookSnippet extends Model
{
    protected $fillable = [
        'book_id',
        'page',
        'kind',
        'language',
        'text',
        'section',
        'stack',
    ];

    protected $casts = [
        'page' => 'integer',
    ];

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class);
    }
}
