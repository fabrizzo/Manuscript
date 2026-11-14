<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\Note;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class NoteController extends Controller
{
    /**
     * Все заметки пользователя по всем книгам.
     */
    public function index(Request $request): InertiaResponse
    {
        $userId = $request->user()->id;

        $q = trim((string) $request->query('q', ''));
        $kind = (string) $request->query('kind', '');
        $tag = trim((string) $request->query('tag', ''));

        $base = Note::query()->whereHas(
            'book',
            fn ($query) => $query->where('user_id', $userId),
        );

        $filtered = (clone $base)
            ->with('book:id,title,author,cover_path')
            ->latest();

        if ($q !== '') {
            $filtered->where(function ($query) use ($q) {
                $query->where('body', 'like', "%{$q}%")
                    ->orWhere('section', 'like', "%{$q}%")
                    ->orWhere('tags', 'like', "%{$q}%");
            });
        }

        if (in_array($kind, ['idea', 'quote', 'question', 'task'], true)) {
            $filtered->where('kind', $kind);
        } else {
            $kind = '';
        }

        if ($tag !== '') {
            $filtered->where('tags', 'like', '%"'.$tag.'"%');
        }

        $notes = $filtered
            ->paginate(24)
            ->withQueryString()
            ->through(fn (Note $note) => $this->transform($note, true));

        $counts = (clone $base)
            ->selectRaw('kind, count(*) as aggregate')
            ->groupBy('kind')
            ->pluck('aggregate', 'kind');

        $tags = (clone $base)
            ->get(['tags'])
            ->pluck('tags')
            ->flatten()
            ->filter()
            ->map(fn ($value) => (string) $value)
            ->countBy()
            ->sortDesc()
            ->take(24)
            ->keys()
            ->values();

        return Inertia::render('notes/index', [
            'notes' => $notes,
            'filters' => [
                'q' => $q,
                'kind' => $kind,
                'tag' => $tag,
            ],
            'counts' => $counts,
            'tags' => $tags,
            'total' => (clone $base)->count(),
            'booksCount' => (clone $base)->distinct()->count('book_id'),
        ]);
    }

    /**
     * Добавить заметку к странице книги.
     */
    public function store(Request $request, Book $book): JsonResponse
    {
        abort_if($book->user_id !== $request->user()->id, 403);

        $note = $book->notes()->create($this->validateNote($request));

        return response()->json($this->transform($note, false), 201);
    }

    /**
     * Обновить заметку.
     */
    public function update(
        Request $request,
        Book $book,
        Note $note,
    ): JsonResponse {
        abort_if($book->user_id !== $request->user()->id, 403);
        abort_if($note->book_id !== $book->id, 404);

        $note->update($this->validateNote($request));

        return response()->json($this->transform($note->fresh(), false));
    }

    /**
     * Удалить заметку.
     */
    public function destroy(
        Request $request,
        Book $book,
        Note $note,
    ): Response {
        abort_if($book->user_id !== $request->user()->id, 403);
        abort_if($note->book_id !== $book->id, 404);

        $note->delete();

        return response()->noContent();
    }

    /**
     * Общая валидация и нормализация заметки.
     */
    private function validateNote(Request $request): array
    {
        $request->merge([
            'body' => trim((string) $request->input('body', '')),
            'section' => $request->filled('section')
                ? mb_substr(trim((string) $request->input('section')), 0, 255)
                : null,
        ]);

        $validated = $request->validate([
            'page' => ['required', 'integer', 'min:1'],
            'kind' => ['required', 'in:idea,quote,question,task'],
            'body' => ['required', 'string', 'max:5000'],
            'tags' => ['nullable', 'array', 'max:8'],
            'tags.*' => ['string', 'max:40'],
            'section' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['tags'] = collect($validated['tags'] ?? [])
            ->map(fn ($tag) => mb_strtolower(trim((string) $tag)))
            ->map(fn ($tag) => ltrim($tag, '#'))
            ->map(fn ($tag) => preg_replace('/["\\\\]/u', '', $tag) ?? '')
            ->map(fn ($tag) => preg_replace('/\s+/u', ' ', $tag) ?? '')
            ->filter(fn ($tag) => $tag !== '')
            ->unique()
            ->take(8)
            ->values()
            ->all();

        return $validated;
    }

    /**
     * Единый формат заметки для читалки и страницы «Все заметки».
     */
    private function transform(Note $note, bool $withBook): array
    {
        $data = [
            'id' => $note->id,
            'page' => $note->page,
            'kind' => $note->kind,
            'body' => $note->body,
            'tags' => $note->tags ?? [],
            'section' => $note->section,
            'created_at' => $note->created_at?->toIso8601String(),
            'updated_at' => $note->updated_at?->toIso8601String(),
        ];

        if ($withBook && $note->relationLoaded('book') && $note->book) {
            $data['book'] = [
                'id' => $note->book->id,
                'title' => $note->book->title,
                'author' => $note->book->author,
                'cover_url' => $note->book->coverUrl(),
            ];
        }

        return $data;
    }
}
