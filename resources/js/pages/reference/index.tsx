import { Head, Link, router } from '@inertiajs/react';
import {
    Code2,
    Copy,
    Database,
    ExternalLink,
    FilterX,
    Layers,
    Search,
    Settings2,
    Terminal,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyToClipboard } from '@/lib/clipboard';
import type { BookSnippet, SnippetKind } from '@/types/reference';

type PaginatorLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type SnippetPaginator = {
    data: BookSnippet[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginatorLink[];
};

type Props = {
    snippets: SnippetPaginator;
    stacks: Record<string, number>;
    kindCounts: Record<string, number>;
    filters: {
        q: string;
        stack: string;
        kind: string;
    };
    total: number;
    booksWithSnippets: number;
    booksTotal: number;
    stacksCount: number;
};

const KIND_META: Record<
    SnippetKind,
    { label: string; icon: typeof Terminal; badge: string }
> = {
    command: {
        label: 'Команда',
        icon: Terminal,
        badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    },
    code: {
        label: 'Код',
        icon: Code2,
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    sql: {
        label: 'SQL',
        icon: Database,
        badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    },
    config: {
        label: 'Конфиг',
        icon: Settings2,
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
};

const KINDS: SnippetKind[] = ['command', 'code', 'sql', 'config'];

const prettifyLink = (label: string) =>
    label
        .replace('&laquo;', '←')
        .replace('&raquo;', '→')
        .replace('Previous', 'Назад')
        .replace('Next', 'Вперёд');

export default function ReferenceIndex({
    snippets,
    stacks,
    kindCounts,
    filters,
    total,
    booksWithSnippets,
    booksTotal,
    stacksCount,
}: Props) {
    const [search, setSearch] = useState(filters.q);
    const firstRender = useRef(true);

    const stackEntries = useMemo(
        () =>
            Object.entries(stacks).sort(
                (a, b) => Number(b[1]) - Number(a[1]),
            ),
        [stacks],
    );

    const allStackCount = useMemo(
        () =>
            stackEntries.reduce(
                (sum, [, count]) => sum + Number(count),
                0,
            ),
        [stackEntries],
    );

    const applyFilters = (patch: Record<string, string>) => {
        const params: Record<string, string> = {
            q: search.trim(),
            stack: filters.stack,
            kind: filters.kind,
            ...patch,
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) delete params[key];
        });

        router.get('/reference', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            if (search.trim() !== filters.q) {
                applyFilters({ q: search.trim() });
            }
        }, 350);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const resetFilters = () => {
        setSearch('');
        router.get('/reference', {}, {
            preserveState: false,
            preserveScroll: true,
            replace: true,
        });
    };

    const copy = async (text: string) => {
        const ok = await copyToClipboard(text);
        if (ok) toast.success('Скопировано');
        else toast.error('Не удалось скопировать');
    };

    const deleteSnippet = async (snippet: BookSnippet) => {
        if (!snippet.book) return;

        if (
            !window.confirm(
                'Удалить этот фрагмент из справочника? Текст в PDF останется, но в справочнике его больше не будет.',
            )
        ) {
            return;
        }

        const token =
            document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content ?? '';

        try {
            const response = await fetch(
                `/books/${snippet.book.id}/reference/snippets/${snippet.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                    },
                    credentials: 'same-origin',
                },
            );

            if (!response.ok) throw new Error('Не удалось удалить фрагмент');

            toast.success('Фрагмент удалён');
            router.reload({
                only: [
                    'snippets',
                    'stacks',
                    'kindCounts',
                    'total',
                    'booksWithSnippets',
                    'stacksCount',
                ],
                preserveScroll: true,
            });
        } catch (e) {
            toast.error(
                e instanceof Error
                    ? e.message
                    : 'Не удалось удалить фрагмент',
            );
        }
    };

    const groups = useMemo(() => {
        const map = new Map<string, BookSnippet[]>();

        for (const snippet of snippets.data) {
            const key = snippet.stack || 'Разное';
            const list = map.get(key);
            if (list) list.push(snippet);
            else map.set(key, [snippet]);
        }

        return [...map.entries()];
    }, [snippets.data]);

    const hasFilters = Boolean(filters.q || filters.stack || filters.kind);
    const hasAnySnippets = stacksCount > 0;

    return (
        <>
            <Head title="Справочник по стекам" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Справочник по стекам
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Команды и код из всех книг, сгруппированные по
                            технологиям.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                            <Layers className="h-3.5 w-3.5" />
                            Стеков: {stacksCount}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                            Фрагментов: {allStackCount}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                            Книг: {booksWithSnippets} из {booksTotal}
                        </span>
                    </div>
                </div>

                {hasAnySnippets && booksWithSnippets < booksTotal && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        Справочники собраны не для всех книг. Откройте книгу →
                        «Справочник», чтобы извлечь команды и код.
                    </div>
                )}

                {hasAnySnippets && (
                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            variant={!filters.stack ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => applyFilters({ stack: '' })}
                        >
                            Все стеки
                            <span className="ml-1.5 text-xs opacity-70">
                                {allStackCount}
                            </span>
                        </Button>

                        {stackEntries.map(([stack, count]) => {
                            const active = filters.stack === stack;

                            return (
                                <Button
                                    key={stack}
                                    variant={active ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                        applyFilters({
                                            stack: active ? '' : stack,
                                        })
                                    }
                                >
                                    {stack}
                                    <span className="ml-1.5 text-xs opacity-70">
                                        {count}
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                )}

                {hasAnySnippets && (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full lg:w-96">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Поиск по командам, коду и книгам…"
                                className="pl-9"
                            />
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <Button
                                variant={!filters.kind ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applyFilters({ kind: '' })}
                            >
                                Все
                                <span className="ml-1.5 text-xs opacity-70">
                                    {total}
                                </span>
                            </Button>

                            {KINDS.map((value) => {
                                const meta = KIND_META[value];
                                const Icon = meta.icon;
                                const active = filters.kind === value;

                                return (
                                    <Button
                                        key={value}
                                        variant={
                                            active ? 'default' : 'outline'
                                        }
                                        size="sm"
                                        onClick={() =>
                                            applyFilters({
                                                kind: active ? '' : value,
                                            })
                                        }
                                    >
                                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                                        {meta.label}
                                        <span className="ml-1.5 text-xs opacity-70">
                                            {Number(
                                                kindCounts[value] ?? 0,
                                            )}
                                        </span>
                                    </Button>
                                );
                            })}

                            {hasFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetFilters}
                                >
                                    <FilterX className="mr-1.5 h-3.5 w-3.5" />
                                    Сбросить
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {!hasAnySnippets ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
                        <Layers className="h-10 w-10 text-muted-foreground/40" />
                        <div>
                            <p className="font-medium">
                                Справочники ещё не собраны
                            </p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                Откройте книгу, нажмите «Справочник» и запустите
                                сборку. После этого команды и код появятся здесь,
                                сгруппированные по стекам.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href="/books">К книгам</Link>
                        </Button>
                    </div>
                ) : snippets.data.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                        <p className="font-medium">Ничего не найдено</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Попробуйте другой запрос или сбросьте фильтры.
                        </p>
                        <Button
                            className="mt-4"
                            variant="outline"
                            onClick={resetFilters}
                        >
                            Сбросить фильтры
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groups.map(([stack, stackSnippets]) => (
                            <section key={stack} className="space-y-2">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                        {stack}
                                    </h2>
                                    <span className="text-xs text-muted-foreground">
                                        {stackSnippets.length} на странице
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {stackSnippets.map((snippet) => {
                                        const meta = KIND_META[snippet.kind];
                                        const Icon = meta.icon;

                                        return (
                                            <article
                                                key={snippet.id}
                                                className="overflow-hidden rounded-lg border border-border bg-card"
                                            >
                                                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
                                                    >
                                                        <Icon className="h-3 w-3" />
                                                        {meta.label}
                                                    </span>

                                                    {snippet.book && (
                                                        <Link
                                                            href={`/books/${snippet.book.id}/reference`}
                                                            className="max-w-[18rem] truncate text-xs font-medium text-foreground hover:underline"
                                                            title={
                                                                snippet.book
                                                                    .title
                                                            }
                                                        >
                                                            {
                                                                snippet.book
                                                                    .title
                                                            }
                                                        </Link>
                                                    )}

                                                    {snippet.book && (
                                                        <Link
                                                            href={`/books/${snippet.book.id}?page=${snippet.page}`}
                                                            className="text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            Стр.{' '}
                                                            {snippet.page}
                                                        </Link>
                                                    )}

                                                    {snippet.language && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {
                                                                snippet.language
                                                            }
                                                        </span>
                                                    )}

                                                    <div className="ml-auto flex items-center gap-0.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() =>
                                                                void copy(
                                                                    snippet.text,
                                                                )
                                                            }
                                                            title="Копировать"
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {snippet.book && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                asChild
                                                                title="Открыть страницу"
                                                            >
                                                                <Link
                                                                    href={`/books/${snippet.book.id}?page=${snippet.page}`}
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </Link>
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() =>
                                                                void deleteSnippet(
                                                                    snippet,
                                                                )
                                                            }
                                                            title="Удалить фрагмент"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
                                                    <code>
                                                        {snippet.text}
                                                    </code>
                                                </pre>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                {snippets.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-1">
                        {snippets.links.map((link, index) =>
                            link.url ? (
                                <Link
                                    key={`${link.label}-${index}`}
                                    href={link.url}
                                    preserveScroll
                                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                        link.active
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {prettifyLink(link.label)}
                                </Link>
                            ) : (
                                <span
                                    key={`${link.label}-${index}`}
                                    className="rounded-md border border-transparent px-2.5 py-1 text-xs text-muted-foreground/50"
                                >
                                    {prettifyLink(link.label)}
                                </span>
                            ),
                        )}
                    </nav>
                )}
            </div>
        </>
    );
}

ReferenceIndex.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
        { title: 'Справочник', href: '/reference' },
    ],
};
