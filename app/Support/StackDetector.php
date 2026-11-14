<?php

namespace App\Support;

use App\Models\Book;

class StackDetector
{
    /**
     * Порядок важен: сначала конкретные технологии, потом общие.
     *
     * @var array<int, array{0:string,1:string}>
     */
    private const TITLE_PATTERNS = [
        ['/postgres/i', 'PostgreSQL'],
        ['/mysql/i', 'MySQL'],
        ['/sql\s*server|t-sql|mssql/i', 'SQL Server'],
        ['/kubernetes|k8s/i', 'Kubernetes'],
        ['/docker/i', 'Docker'],
        ['/linux/i', 'Linux'],
        ['/react\s+native/i', 'React Native'],
        ['/react/i', 'React'],
        ['/typescript/i', 'TypeScript'],
        ['/javascript/i', 'JavaScript'],
        ['/kotlin/i', 'Kotlin'],
        ['/android/i', 'Android'],
        ['/c#|c\s*sharp|\.net|asp\.net|entity framework|clr/i', 'C# / .NET'],
        ['/c\+\+|c\s*plus\s*plus/i', 'C++'],
        ['/python/i', 'Python'],
        ['/laravel/i', 'Laravel'],
        ['/php/i', 'PHP'],
        ['/golang|\bgo\b/i', 'Go'],
        ['/rust/i', 'Rust'],
        ['/1[сc]/iu', '1C'],
        ['/git/i', 'Git'],
        ['/sql/i', 'SQL'],
    ];

    /**
     * @var array<string, string>
     */
    private const CATEGORY_STACKS = [
        'linux' => 'Linux',
        'docker' => 'Docker',
        'sql' => 'SQL',
        'базы данных' => 'SQL',
        'c#' => 'C# / .NET',
        'c++' => 'C++',
        'python' => 'Python',
        'kotlin' => 'Kotlin',
        'react' => 'React',
        'typescript' => 'TypeScript',
        'javascript' => 'JavaScript',
        'php' => 'PHP',
        'laravel' => 'Laravel',
        'go' => 'Go',
        'java' => 'Java',
        'rust' => 'Rust',
        '1c' => '1C',
        'ml' => 'ML',
        'алгоритмы' => 'Алгоритмы',
        'архитектура' => 'Архитектура',
        'тестирование' => 'Тестирование',
    ];

    /**
     * @var array<string, string>
     */
    private const LANGUAGE_STACKS = [
        'bash' => 'Linux',
        'shell' => 'Linux',
        'sql' => 'SQL',
        'csharp' => 'C# / .NET',
        'cpp' => 'C++',
        'python' => 'Python',
        'php' => 'PHP',
        'javascript' => 'JavaScript',
        'typescript' => 'TypeScript',
        'kotlin' => 'Kotlin',
        'java' => 'Java',
        'go' => 'Go',
        'rust' => 'Rust',
        'dockerfile' => 'Docker',
    ];

    public static function detect(
        Book $book,
        ?string $language = null,
        ?string $kind = null,
    ): string {
        $stack = self::fromTitle($book->title);
        if ($stack !== null) {
            return $stack;
        }

        $category = $book->category?->name;
        $stack = self::fromCategory($category);
        if ($stack !== null) {
            return $stack;
        }

        $stack = self::fromLanguage($language);
        if ($stack !== null) {
            return $stack;
        }

        if ($category && $category !== 'Разное') {
            return $category;
        }

        return 'Разное';
    }

    public static function fromTitle(?string $title): ?string
    {
        if (! $title) {
            return null;
        }

        foreach (self::TITLE_PATTERNS as [$pattern, $stack]) {
            if (preg_match($pattern, $title)) {
                return $stack;
            }
        }

        if (preg_match('/(?:^|\s)c(?:\s|$)/i', $title)) {
            return 'C';
        }

        return null;
    }

    public static function fromCategory(?string $category): ?string
    {
        if (! $category) {
            return null;
        }

        $key = mb_strtolower(trim($category));

        return self::CATEGORY_STACKS[$key] ?? null;
    }

    public static function fromLanguage(?string $language): ?string
    {
        if (! $language) {
            return null;
        }

        $key = mb_strtolower(trim($language));

        return self::LANGUAGE_STACKS[$key] ?? null;
    }
}
