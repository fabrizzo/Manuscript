<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\BookSnippet;
use App\Services\BookTextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class ReferenceController extends Controller
{
    /**
     * Стек-ориентированный справочник по всем книгам пользователя.
     */
    public function index(Request $request): InertiaResponse
    {
        $userId = $request->user()->id;

        $q = trim((string) $request->query('q', ''));
        $stack = trim((string) $request->query('stack', ''));
        $kind = (string) $request->query('kind', '');

        $base = BookSnippet::query()
            ->join('books', 'books.id', '=', 'book_snippets.book_id')
            ->where('books.user_id', $userId)
            ->select('book_snippets.*');

        if ($q !== '') {
            $base->where(function ($query) use ($q) {
                $query->where('book_snippets.text', 'like', "%{$q}%")
                    ->orWhere('book_snippets.section', 'like', "%{$q}%")
                    ->orWhere('books.title', 'like', "%{$q}%");
            });
        }

        if ($stack !== '') {
            $base->where('book_snippets.stack', $stack);
        }

        $filtered = clone $base;

        if (in_array($kind, ['command', 'code', 'config', 'sql'], true)) {
            $filtered->where('book_snippets.kind', $kind);
        } else {
            $kind = '';
        }

        $snippets = $filtered
            ->with('book:id,title,author,cover_path')
            ->orderBy('book_snippets.stack')
            ->orderBy('book_snippets.page')
            ->orderBy('book_snippets.id')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (BookSnippet $snippet) => [
                'id' => $snippet->id,
                'page' => $snippet->page,
                'kind' => $snippet->kind,
                'language' => $snippet->language,
                'text' => $snippet->text,
                'section' => $snippet->section,
                'stack' => $snippet->stack,
                'book' => $snippet->book ? [
                    'id' => $snippet->book->id,
                    'title' => $snippet->book->title,
                    'author' => $snippet->book->author,
                ] : null,
            ]);

        $stacks = BookSnippet::query()
            ->join('books', 'books.id', '=', 'book_snippets.book_id')
            ->where('books.user_id', $userId)
            ->whereNotNull('book_snippets.stack')
            ->select(
                'book_snippets.stack',
                DB::raw('count(*) as aggregate'),
            )
            ->groupBy('book_snippets.stack')
            ->orderByDesc('aggregate')
            ->pluck('aggregate', 'stack');

        $kindCounts = (clone $base)
            ->select(
                'book_snippets.kind',
                DB::raw('count(*) as aggregate'),
            )
            ->groupBy('book_snippets.kind')
            ->pluck('aggregate', 'kind');

        return Inertia::render('reference/index', [
            'snippets' => $snippets,
            'stacks' => $stacks,
            'kindCounts' => $kindCounts,
            'filters' => [
                'q' => $q,
                'stack' => $stack,
                'kind' => $kind,
            ],
            'total' => (clone $base)->count(),
            'booksWithSnippets' => BookSnippet::query()
                ->join('books', 'books.id', '=', 'book_snippets.book_id')
                ->where('books.user_id', $userId)
                ->distinct()
                ->count('book_snippets.book_id'),
            'booksTotal' => Book::query()
                ->where('user_id', $userId)
                ->count(),
            'stacksCount' => $stacks->count(),
        ]);
    }

    public function show(Request $request, Book $book): InertiaResponse
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        $snippets = $book->snippets()
            ->get(['id', 'page', 'kind', 'language', 'text', 'section', 'stack'])
            ->map(fn ($snippet) => [
                'id' => $snippet->id,
                'page' => $snippet->page,
                'kind' => $snippet->kind,
                'language' => $snippet->language,
                'text' => $snippet->text,
                'section' => $snippet->section,
                'stack' => $snippet->stack,
            ]);

        $counts = $snippets->countBy('kind');

        return Inertia::render('books/reference', [
            'book' => [
                'id' => $book->id,
                'title' => $book->title,
                'author' => $book->author,
                'total_pages' => $book->total_pages,
                'file_url' => \Illuminate\Support\Facades\Storage::disk('public')->url($book->file_path),
                'text_status' => $book->text_status ?? 'pending',
                'text_indexed_at' => $book->text_indexed_at?->toIso8601String(),
                'snippets_count' => $book->snippets_count ?? 0,
            ],
            'snippets' => $snippets->values(),
            'counts' => $counts,
        ]);
    }

    /**
     * Сохранить извлечённый текст/команды (вызывается из браузера после pdf.js).
     */
    public function store(
        Request $request,
        Book $book,
        BookTextService $service,
    ): JsonResponse {
        abort_if($book->user_id !== $request->user()->id, 403);

        $validated = $request->validate([
            'snippets' => ['present', 'array', 'max:2000'],
            'snippets.*.page' => ['required', 'integer', 'min:1'],
            'snippets.*.kind' => ['required', 'in:command,code,config,sql'],
            'snippets.*.language' => ['nullable', 'string', 'max:30'],
            'snippets.*.text' => ['required', 'string', 'max:4000'],
            'snippets.*.section' => ['nullable', 'string', 'max:255'],
            'text_status' => ['required', 'in:ready,empty,failed'],
        ]);

        $service->sync(
            $book,
            $validated['snippets'],
            $validated['text_status'],
        );

        $book->refresh();

        return response()->json([
            'text_status' => $book->text_status,
            'snippets_count' => $book->snippets_count,
            'text_indexed_at' => $book->text_indexed_at?->toIso8601String(),
        ]);
    }

    /**
     * Удалить один фрагмент справочника.
     */
    public function destroySnippet(
        Request $request,
        Book $book,
        BookSnippet $snippet,
    ): Response {
        abort_if($book->user_id !== $request->user()->id, 403);
        abort_if($snippet->book_id !== $book->id, 404);

        $snippet->delete();

        $book->update([
            'snippets_count' => BookSnippet::query()
                ->where('book_id', $book->id)
                ->count(),
        ]);

        return response()->noContent();
    }

    /**
     * Очистить справочник.
     */
    public function destroy(Request $request, Book $book): Response
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        \App\Models\BookSnippet::query()->where('book_id', $book->id)->delete();
        $book->update([
            'text_status' => 'pending',
            'text_indexed_at' => null,
            'snippets_count' => 0,
        ]);

        return response()->noContent();
    }
}
