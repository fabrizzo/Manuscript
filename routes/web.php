<?php

use App\Http\Controllers\BookController;
use App\Http\Controllers\BookmarkController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('books.index'))->name('home');

Route::middleware(['auth'])->group(function () {
     // Читалка
    Route::get('books', [BookController::class, 'index'])->name('books.index');
    Route::get('books/create', [BookController::class, 'create'])->name('books.create');
    Route::post('books', [BookController::class, 'store'])->name('books.store');
    Route::get('books/{book}/edit', [BookController::class, 'edit'])->name('books.edit');
    Route::patch('books/{book}', [BookController::class, 'update'])->name('books.update');
    Route::delete('books/{book}', [BookController::class, 'destroy'])->name('books.destroy');
    Route::get('books/{book}', [BookController::class, 'show'])->name('books.show');
    Route::post('books/{book}/progress', [BookController::class, 'updateProgress'])->name('books.progress');
    Route::post('books/{book}/bookmarks', [BookmarkController::class, 'store'])->name('bookmarks.store');
    Route::patch('books/{book}/bookmarks/{bookmark}', [BookmarkController::class, 'update'])->name('bookmarks.update');
    Route::delete('books/{book}/bookmarks/{bookmark}', [BookmarkController::class, 'destroy'])->name('bookmarks.destroy');
});

require __DIR__.'/settings.php';