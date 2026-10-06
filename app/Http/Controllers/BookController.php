<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBookRequest;
use App\Http\Requests\UpdateBookRequest;
use App\Models\Book;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class BookController extends Controller
{
    /**
     * Список всех книг текущего пользователя.
     */
public function index(Request $request): Response
{
    $categories = \App\Models\Category::query()
    ->withCount(['books' => function ($q) use ($request) {
        $q->where('user_id', $request->user()->id);
    }])
    ->orderBy('name')
    ->get(['id', 'name', 'slug']);

    $selectedCategory = $request->query('category');

    $search = $request->query('search');

    $booksQuery = Book::query()
        ->where('user_id', $request->user()->id)
        ->with(['progress', 'category'])
        ->latest();

    if ($search) {
        $booksQuery->where(function ($q) use ($search) {
            $q->where('title', 'like', "%{$search}%")
            ->orWhere('author', 'like', "%{$search}%");
        });
    }

    if ($selectedCategory) {
        $booksQuery->whereHas('category', function ($q) use ($selectedCategory) {
            $q->where('slug', $selectedCategory);
        });
    }

    $totalBooks = Book::where('user_id', $request->user()->id)->count();

    $books = $booksQuery
    ->paginate(12)
    ->withQueryString()
    ->through(fn (Book $book) => [
        'id' => $book->id,
        'title' => $book->title,
        'author' => $book->author,
        'file_path' => $book->file_path,
        'cover_url' => $book->coverUrl(),
        'total_pages' => $book->total_pages,
        'current_page' => $book->progress?->current_page ?? 1,
        'percent_read' => $book->percentRead(),
        'created_at' => $book->created_at->toIso8601String(),
        'file_size' => $book->file_size,
        'pdf_metadata' => $book->pdf_metadata,
        'category' => $book->category ? [
            'id' => $book->category->id,
            'name' => $book->category->name,
            'slug' => $book->category->slug,
        ] : null,
    ]);

    $continueReading = Book::query()
    ->where('books.user_id', $request->user()->id)
    ->join('reading_progress', 'reading_progress.book_id', '=', 'books.id')
    ->where('reading_progress.current_page', '>', 1)
    ->orderByDesc('reading_progress.updated_at')
    ->with(['progress', 'category'])
    ->first([
        'books.id',
        'books.title',
        'books.author',
        'books.cover_path',
        'books.total_pages',
        'books.category_id',
    ]);

    return Inertia::render('books/index', [
        'books' => $books,
        'categories' => $categories,
        'search' => $search,
        'totalBooks' => $totalBooks,   // ← добавили
        'selectedCategory' => $selectedCategory,
        'continueReading' => $continueReading ? [
            'id' => $continueReading->id,
            'title' => $continueReading->title,
            'author' => $continueReading->author,
            'cover_url' => $continueReading->coverUrl(),
            'total_pages' => $continueReading->total_pages,
            'current_page' => $continueReading->progress?->current_page ?? 1,
            'percent_read' => $continueReading->percentRead(),
            'last_read_at' => $continueReading->progress?->updated_at?->toIso8601String(),
            'category' => $continueReading->category ? [
                'id' => $continueReading->category->id,
                'name' => $continueReading->category->name,
            ] : null,
        ] : null,
    ]);
}

    /**
     * Форма загрузки новой книги.
     */
public function create(): Response
    {
    return Inertia::render('books/create', [
        'categories' => \App\Models\Category::orderBy('name')
            ->get(['id', 'name']),
    ]);
}

    /**
     * Сохранить загруженную книгу.
     */
   public function store(StoreBookRequest $request): RedirectResponse
    {
        $file = $request->file('file');
        $path = $file->store('books', 'public');

        // Сохраняем обложку, если пришла
        $coverPath = null;
        if ($request->filled('cover')) {
            $coverPath = $this->saveCoverFromDataUrl($request->input('cover'));
        }

        $pdfMetadata = null;
        if ($request->filled('pdf_metadata')) {
            $decoded = json_decode($request->input('pdf_metadata'), true);
            if (is_array($decoded)) {
                $pdfMetadata = $decoded;
            }
        }

        $book = Book::create([
            'user_id' => $request->user()->id,
            'category_id' => $request->input('category_id') ?: null,
            'title' => $request->string('title')->toString(),
            'author' => $request->string('author')->toString() ?: null,
            'file_path' => $path,
            'cover_path' => $coverPath,
            'original_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'pdf_metadata' => $pdfMetadata,
            'total_pages' => null,
        ]);

        return redirect()
            ->route('books.show', $book)
            ->with('success', 'Книга загружена');
    }

    /**
     * Декодирует base64 dataURL и сохраняет как JPEG в storage/app/public/covers.
     * Возвращает относительный путь или null при ошибке.
     */
    private function saveCoverFromDataUrl(string $dataUrl): ?string
    {
        // Формат: data:image/jpeg;base64,/9j/4AAQ...
        if (! preg_match('#^data:image/(jpeg|png);base64,(.+)$#', $dataUrl, $m)) {
            return null;
        }

        $binary = base64_decode($m[2], true);
        if ($binary === false) {
            return null;
        }

        // Защита: не больше 2 МБ на обложку
        if (strlen($binary) > 2 * 1024 * 1024) {
            return null;
        }

        $ext = $m[1] === 'png' ? 'png' : 'jpg';
        $filename = 'covers/' . \Illuminate\Support\Str::random(40) . '.' . $ext;

        \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $binary);

        return $filename;
    }

    /**
     * Читалка: открыть книгу.
     */
    public function show(Request $request, Book $book): Response
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        return Inertia::render('books/reader', [
            'book' => [
                'id' => $book->id,
                'title' => $book->title,
                'author' => $book->author,
                'file_path' => $book->file_path,
                'description' => $book->description,
                'file_url' => Storage::disk('public')->url($book->file_path),
                'total_pages' => $book->total_pages,
                'current_page' => $book->progress?->current_page ?? 1,
            ],
            'bookmarks' => $book->bookmarks()->get(['id', 'page', 'label']),
        ]);
    }

    /**
     * Обновить прогресс чтения (вызывается из pdf.js при перелистывании).
     */
    public function updateProgress(Request $request, Book $book): RedirectResponse
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        $validated = $request->validate([
            'current_page' => ['required', 'integer', 'min:1'],
            'total_pages' => ['nullable', 'integer', 'min:1'],
        ]);

        $book->progress()->updateOrCreate(
            ['book_id' => $book->id],
            ['current_page' => $validated['current_page']],
        );

        if (! empty($validated['total_pages']) && $book->total_pages !== $validated['total_pages']) {
            $book->update(['total_pages' => $validated['total_pages']]);
        }

        return back();
    }

    public function destroy(Request $request, Book $book): RedirectResponse
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        // Удаляем файлы (PDF + обложку)
        Storage::disk('public')->delete($book->file_path);
        if ($book->cover_path) {
            Storage::disk('public')->delete($book->cover_path);
        }

        // Прогресс удалится каскадом (cascadeOnDelete в миграции)
        $book->delete();

        return redirect()
            ->route('books.index')
            ->with('success', 'Книга удалена');
    }
    /**
     * Форма редактирования книги.
     */
    public function edit(Request $request, Book $book): Response
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        return Inertia::render('books/edit', [
            'book' => [
                'id' => $book->id,
                'title' => $book->title,
                'author' => $book->author,
                'description' => $book->description,
                'category_id' => $book->category_id,
                'cover_url' => $book->coverUrl(),
                'file_url' => Storage::disk('public')->url($book->file_path),
                'total_pages' => $book->total_pages,
            ],
            'categories' => \App\Models\Category::orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /**
     * Обновить книгу.
     */
    public function update(
        UpdateBookRequest $request,
        Book $book
    ): RedirectResponse {
        abort_if($book->user_id !== $request->user()->id, 403);

        $data = [
            'title' => $request->string('title')->toString(),
            'author' => $request->string('author')->toString() ?: null,
            'description' => $request->string('description')->toString() ?: null,
            'category_id' => $request->input('category_id') ?: null,
        ];

        // Если пришла новая обложка — сохраняем
        if ($request->filled('cover')) {
            $newCover = $this->saveCoverFromDataUrl($request->input('cover'));
            if ($newCover) {
                // Удаляем старую
                if ($book->cover_path) {
                    Storage::disk('public')->delete($book->cover_path);
                }
                $data['cover_path'] = $newCover;
            }
        }

        $book->update($data);

        return redirect()
            ->route('books.index')
            ->with('success', 'Книга обновлена');
    }
}