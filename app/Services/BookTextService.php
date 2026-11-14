<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookSnippet;
use App\Support\StackDetector;
use Illuminate\Support\Facades\DB;

class BookTextService
{
    private const KINDS = ['command', 'code', 'config', 'sql'];

    private const STATUSES = ['ready', 'empty', 'failed', 'pending'];

    /**
     * Сохраняет извлечённые фрагменты книги.
     *
     * @param  array<int, array<string, mixed>>  $snippets
     */
    public function sync(Book $book, array $snippets, string $status = 'ready'): void
    {
        $status = in_array($status, self::STATUSES, true) ? $status : 'ready';

        if ($status === 'failed') {
            $book->update(['text_status' => 'failed']);

            return;
        }

        $normalized = $this->normalize($snippets, $book);

        DB::transaction(function () use ($book, $normalized, $status) {
            BookSnippet::query()->where('book_id', $book->id)->delete();

            $now = now();
            foreach (array_chunk($normalized, 100) as $chunk) {
                BookSnippet::insert(array_map(
                    fn (array $snippet) => [
                        'book_id' => $book->id,
                        'page' => $snippet['page'],
                        'kind' => $snippet['kind'],
                        'language' => $snippet['language'],
                        'text' => $snippet['text'],
                        'section' => $snippet['section'],
                        'stack' => $snippet['stack'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                    $chunk,
                ));
            }

            $book->update([
                'text_status' => $status,
                'text_indexed_at' => $now,
                'snippets_count' => count($normalized),
            ]);
        });
    }

    /**
     * @param  array<int, array<string, mixed>>  $snippets
     * @return array<int, array{page:int,kind:string,language:?string,text:string,section:?string,stack:string}>
     */
    private function normalize(array $snippets, Book $book): array
    {
        $normalized = [];

        foreach ($snippets as $snippet) {
            if (! is_array($snippet)) {
                continue;
            }

            $text = trim((string) ($snippet['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $kind = (string) ($snippet['kind'] ?? 'code');
            if (! in_array($kind, self::KINDS, true)) {
                $kind = 'code';
            }

            $page = max(1, (int) ($snippet['page'] ?? 1));
            $language = isset($snippet['language']) && $snippet['language'] !== ''
                ? mb_substr((string) $snippet['language'], 0, 30)
                : null;
            $section = isset($snippet['section']) && $snippet['section'] !== ''
                ? mb_substr((string) $snippet['section'], 0, 255)
                : null;

            $text = mb_substr($text, 0, 4000);
            $key = $page.'|'.$kind.'|'.preg_replace('/\s+/u', ' ', $text);

            if (isset($normalized[$key])) {
                continue;
            }

            $normalized[$key] = [
                'page' => $page,
                'kind' => $kind,
                'language' => $language,
                'text' => $text,
                'section' => $section,
                'stack' => StackDetector::detect($book, $language, $kind),
            ];

            if (count($normalized) >= 2000) {
                break;
            }
        }

        return array_values($normalized);
    }
}
