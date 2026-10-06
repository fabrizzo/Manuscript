<?php

namespace App\Models;

use App\Models\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Book extends Model
{
    protected $fillable = [
    'user_id',
    'category_id',
    'title',
    'author',
    'description',
    'file_path',
    'cover_path',
    'original_name',
    'file_size',        // ← добавили
    'pdf_metadata',     // ← добавили
    'total_pages',
    ];

    protected $casts = [
    'pdf_metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class)->orderBy('page');
    }

    public function progress(): HasOne
    {
        return $this->hasOne(ReadingProgress::class);
    }
	
	public function category(): BelongsTo
	{
		return $this->belongsTo(Category::class);
	}

    public function percentRead(): int
    {
        if (! $this->total_pages || ! $this->progress) {
            return 0;
        }

        return (int) round(
            min($this->progress->current_page, $this->total_pages)
            / $this->total_pages * 100
        );
    }

    public function coverUrl(): ?string
    {
        if (! $this->cover_path) {
            return null;
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->cover_path);
    }
}