<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\Bookmark;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BookmarkController extends Controller
{
    /**
     * Добавить закладку на странице.
     * Если закладка на этой странице уже есть — обновляем label.
     */
    public function store(Request $request, Book $book): RedirectResponse
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        $validated = $request->validate([
            'page' => ['required', 'integer', 'min:1'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $book->bookmarks()->updateOrCreate(
            ['page' => $validated['page']],
            ['label' => $validated['label'] ?? null],
        );

        return back();
    }

    /**
     * Обновить метку существующей закладки.
     */
    public function update(
        Request $request,
        Book $book,
        Bookmark $bookmark
    ): RedirectResponse {
        abort_if($book->user_id !== $request->user()->id, 403);
        abort_if($bookmark->book_id !== $book->id, 404);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $bookmark->update($validated);

        return back();
    }

    /**
     * Удалить закладку.
     */
    public function destroy(
        Request $request,
        Book $book,
        Bookmark $bookmark
    ): RedirectResponse {
        abort_if($book->user_id !== $request->user()->id, 403);
        abort_if($bookmark->book_id !== $book->id, 404);

        $bookmark->delete();

        return back();
    }
}