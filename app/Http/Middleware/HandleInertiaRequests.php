<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $recentBooks = [];

        if ($request->user()) {
            $recentBooks = \App\Models\Book::query()
                ->where('books.user_id', $request->user()->id)
                ->join('reading_progress', 'reading_progress.book_id', '=', 'books.id')
                ->orderByDesc('reading_progress.updated_at')
                ->limit(5)
                ->get([
                    'books.id',
                    'books.title',
                    'reading_progress.current_page',
                ])
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'title' => $row->title,
                    'current_page' => $row->current_page,
                ])
                ->all();
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'recentBooks' => $recentBooks,
        ];
    }
}
