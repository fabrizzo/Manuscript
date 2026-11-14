import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    Code2,
    Copy,
    Database,
    ExternalLink,
    Layers,
    RefreshCw,
    ScanLine,
    Search,
    Settings2,
    Terminal,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { copyToClipboard } from '@/lib/clipboard';
import { extractBookSnippets } from '@/lib/pdf-snippets';
import type {
    BookSnippet,
    SnippetKind,
    TextStatus,
} from '@/types/reference';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
    book: {
        id: number;
        title: string;
        author: string | null;
        total_pages: number | null;
        file_url: string;
        text_status: TextStatus;
        text_indexed_at: string | null;
        snippets_count: number;
    };
    snippets: BookSnippet[];
    counts: Record<string, number>;
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

export default function BookReferencePage({
    book,
    snippets,
    counts,
}: Props) {
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState<SnippetKind | ''>('');
    const [extracting, setExtracting] = useState(false);
    const [progress, setProgress] = useState({
        page: 0,
        total: 0,
        snippets: 0,
    });

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return snippets.filter((snippet) => {
            if (kind && snippet.kind !== kind) return false;
            if (!query) return true;

            return (
                snippet.text.toLowerCase().includes(query) ||
                (snippet.section ?? '').toLowerCase().includes(query) ||
                (snippet.language ?? '').toLowerCase().includes(query)
            );
        });
    }, [snippets, search, kind]);

    const groups = useMemo(() => {
        const map = new Map<string, BookSnippet[]>();

        for (const snippet of filtered) {
            const key = snippet.section || 'Без главы';
            const list = map.get(key);
            if (list) list.push(snippet);
            else map.set(key, [snippet]);
        }

        return [...map.entries()];
    }, [filtered]);

    const totalFound = snippets.length;

    const copy = async (text: string) => {
        const ok = await copyToClipboard(text);
        if (ok) toast.success('Скопировано');
        else toast.error('Не удалось скопировать');
    };

    const deleteSnippet = async (snippet: BookSnippet) => {
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
                `/books/${book.id}/reference/snippets/${snippet.id}`,
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
                only: ['book', 'snippets', 'counts'],
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

    const collect = async () => {
        if (extracting) return;

        if (
            totalFound > 0 &&
            !window.confirm(
                'Пересобрать справочник? Текущие фрагменты будут заменены.',
            )
        ) {
            return;
        }

        setExtracting(true);
        setProgress({ page: 0, total: book.total_pages ?? 0, snippets: 0 });

        let pdf: any = null;

        try {
            const buffer = await (
                await fetch(book.file_url, { credentials: 'same-origin' })
            ).arrayBuffer();

            pdf = await pdfjsLib.getDocument({
                data: buffer,
                wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`,
            }).promise;

            const result = await extractBookSnippets(pdf, (value) =>
                setProgress(value),
            );

            if (!result) throw new Error('Извлечение отменено');

            const token =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';

            const response = await fetch(
                `/books/${book.id}/reference`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        snippets: result.snippets,
                        text_status: result.textStatus,
                    }),
                },
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    (data?.message as string) ||
                        'Не удалось сохранить справочник',
                );
            }

            if (result.snippets.length === 0) {
                toast.info(
                    result.textStatus === 'empty'
                        ? 'В PDF нет текстового слоя'
                        : 'Текст есть, но команд и кода не найдено',
                );
            } else {
                toast.success(
                    `Справочник собран: ${result.snippets.length} фрагментов`,
                );
            }

            router.reload({
                only: ['book', 'snippets', 'counts'],
                preserveScroll: true,
            });
        } catch (e) {
            toast.error(
                e instanceof Error
                    ? e.message
                    : 'Не удалось собрать справочник',
            );
        } finally {
            setExtracting(false);
            try {
                pdf?.destroy?.();
            } catch {
                // ignore
            }
        }
    };

    const indexedAt = book.text_indexed_at
        ? new Date(book.text_indexed_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : null;

    return (
        <>
            <Head title={`Справочник — ${book.title}`} />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="-ml-2 self-start"
                    >
                        <Link href={`/books/${book.id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К книге
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold tracking-tight">
                                Справочник
                            </h1>
                            <p className="truncate text-muted-foreground">
                                {book.title}
                                {book.author && (
                                    <span> · {book.author}</span>
                                )}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {book.total_pages
                                    ? `Стр. ${book.total_pages}`
                                    : 'Страниц: —'}
                                {' · '}
                                Фрагментов: {totalFound}
                                {indexedAt && ` · Обновлён ${indexedAt}`}
                            </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                            {totalFound > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => void collect()}
                                    disabled={extracting}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Пересобрать
                                </Button>
                            )}
                            <Button asChild variant="outline">
                                <Link href="/reference">
                                    <Layers className="mr-2 h-4 w-4" />
                                    Все стеки
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={`/books/${book.id}`}>
                                    <BookOpen className="mr-2 h-4 w-4" />
                                    Читать
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {extracting && (
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Spinner className="h-4 w-4" />
                            Извлекаю текст и команды…
                            <span className="ml-auto text-xs text-muted-foreground">
                                {progress.page} / {progress.total || '…'}
                            </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{
                                    width: `${
                                        progress.total
                                            ? Math.round(
                                                  (progress.page /
                                                      progress.total) *
                                                      100,
                                              )
                                            : 0
                                    }%`,
                                }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Найдено фрагментов: {progress.snippets}
                        </p>
                    </div>
                )}

                {!extracting && totalFound === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
                        {book.text_status === 'empty' ? (
                            <>
                                <ScanLine className="mx-auto h-10 w-10 text-muted-foreground/40" />
                                <p className="mt-3 font-medium">
                                    Это скан
                                </p>
                                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                    В PDF нет текстового слоя, поэтому
                                    справочник собрать нельзя. Текст можно
                                    читать как изображение.
                                </p>
                            </>
                        ) : book.text_status === 'ready' ? (
                            <>
                                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600/60" />
                                <p className="mt-3 font-medium">
                                    Текст распознан
                                </p>
                                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                    Команд и фрагментов кода не найдено.
                                    Можно попробовать пересобрать справочник.
                                </p>
                                <Button
                                    className="mt-4"
                                    variant="outline"
                                    onClick={() => void collect()}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Пересобрать
                                </Button>
                            </>
                        ) : (
                            <>
                                <Code2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                                <p className="mt-3 font-medium">
                                    Справочник ещё не собран
                                </p>
                                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                    Извлечём команды, код, SQL и конфиги из
                                    текстового слоя PDF. Это займёт несколько
                                    секунд.
                                </p>
                                <Button
                                    className="mt-4"
                                    onClick={() => void collect()}
                                >
                                    <Code2 className="mr-2 h-4 w-4" />
                                    Собрать справочник
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Поиск по командам, коду и главам…"
                                    className="pl-9"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    variant={!kind ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setKind('')}
                                >
                                    Все
                                    <span className="ml-1.5 text-xs opacity-70">
                                        {totalFound}
                                    </span>
                                </Button>
                                {KINDS.map((value) => {
                                    const meta = KIND_META[value];
                                    const Icon = meta.icon;
                                    const active = kind === value;

                                    return (
                                        <Button
                                            key={value}
                                            variant={
                                                active
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setKind(active ? '' : value)
                                            }
                                        >
                                            <Icon className="mr-1.5 h-3.5 w-3.5" />
                                            {meta.label}
                                            <span className="ml-1.5 text-xs opacity-70">
                                                {Number(counts[value] ?? 0)}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                                Ничего не найдено. Попробуйте другой запрос или
                                сбросьте фильтр.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {groups.map(([section, sectionSnippets]) => {
                                    const pages = sectionSnippets.map(
                                        (snippet) => snippet.page,
                                    );
                                    const minPage = Math.min(...pages);
                                    const maxPage = Math.max(...pages);

                                    return (
                                        <section
                                            key={section}
                                            className="space-y-2"
                                        >
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                <h2 className="text-sm font-semibold">
                                                    {section}
                                                </h2>
                                                <span className="text-xs text-muted-foreground">
                                                    {sectionSnippets.length} · стр.{' '}
                                                    {minPage === maxPage
                                                        ? minPage
                                                        : `${minPage}–${maxPage}`}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {sectionSnippets.map(
                                                    (snippet) => {
                                                        const meta =
                                                            KIND_META[
                                                                snippet.kind
                                                            ];
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
                                                                    <Link
                                                                        href={`/books/${book.id}?page=${snippet.page}`}
                                                                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                                                    >
                                                                        Стр.{' '}
                                                                        {
                                                                            snippet.page
                                                                        }
                                                                    </Link>
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
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                            asChild
                                                                            title="Открыть страницу"
                                                                        >
                                                                            <Link
                                                                                href={`/books/${book.id}?page=${snippet.page}`}
                                                                            >
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </Link>
                                                                        </Button>
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
                                                                        {
                                                                            snippet.text
                                                                        }
                                                                    </code>
                                                                </pre>
                                                            </article>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

BookReferencePage.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
        { title: 'Справочник', href: '#' },
    ],
};
