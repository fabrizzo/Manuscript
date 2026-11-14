import { Head, Link, router } from '@inertiajs/react';
import { FilterX, NotebookPen, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NoteCard } from '@/components/notes/note-card';
import { NoteComposer } from '@/components/notes/note-composer';
import { NOTE_KINDS } from '@/components/notes/note-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Note } from '@/types/note';

type PaginatorLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type NotePaginator = {
    data: Note[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginatorLink[];
};

type Props = {
    notes: NotePaginator;
    filters: {
        q: string;
        kind: string;
        tag: string;
    };
    counts: Record<string, number>;
    tags: string[];
    total: number;
    booksCount: number;
};

const prettifyLink = (label: string) =>
    label
        .replace('&laquo;', '←')
        .replace('&raquo;', '→')
        .replace('Previous', 'Назад')
        .replace('Next', 'Вперёд');

export default function NotesIndex({
    notes,
    filters,
    counts,
    tags,
    total,
    booksCount,
}: Props) {
    const [search, setSearch] = useState(filters.q);
    const [composerOpen, setComposerOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const firstRender = useRef(true);

    const applyFilters = (patch: Record<string, string>) => {
        const params: Record<string, string> = {
            q: search.trim(),
            kind: filters.kind,
            tag: filters.tag,
            ...patch,
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) delete params[key];
        });

        router.get('/notes', params, {
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
        router.get('/notes', {}, {
            preserveState: false,
            preserveScroll: true,
            replace: true,
        });
    };

    const openNote = (note: Note) => {
        if (!note.book) return;
        router.visit(`/books/${note.book.id}?page=${note.page}`);
    };

    const reloadNotes = () => {
        router.reload({
            only: ['notes', 'counts', 'tags', 'total', 'booksCount'],
            preserveScroll: true,
        });
    };

    const deleteNote = async (note: Note) => {
        if (!note.book) return;
        if (!window.confirm('Удалить заметку? Это действие нельзя отменить.')) {
            return;
        }

        const token =
            document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content ?? '';

        try {
            const response = await fetch(
                `/books/${note.book.id}/notes/${note.id}`,
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

            if (!response.ok) throw new Error('Не удалось удалить заметку');
            toast.success('Заметка удалена');
            reloadNotes();
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : 'Не удалось удалить заметку',
            );
        }
    };

    const hasFilters = Boolean(filters.q || filters.kind || filters.tag);
    const activeCount = Object.values(counts).reduce(
        (sum, value) => sum + Number(value),
        0,
    );

    return (
        <>
            <Head title="Заметки" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Заметки
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Заметок: {total} · Книг: {booksCount}
                        </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    applyFilters({ q: search.trim() });
                                }
                            }}
                            placeholder="Поиск по заметкам, главам и тегам…"
                            className="pr-9 pl-9"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    applyFilters({ q: '' });
                                }}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label="Очистить поиск"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        variant={!filters.kind ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyFilters({ kind: '' })}
                    >
                        Все
                        <span
                            className={`ml-1.5 text-xs ${
                                !filters.kind
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            {activeCount}
                        </span>
                    </Button>

                    {NOTE_KINDS.map((kind) => {
                        const Icon = kind.icon;
                        const active = filters.kind === kind.value;
                        const count = Number(counts[kind.value] ?? 0);

                        return (
                            <Button
                                key={kind.value}
                                variant={active ? 'default' : 'outline'}
                                size="sm"
                                onClick={() =>
                                    applyFilters({
                                        kind: active ? '' : kind.value,
                                    })
                                }
                            >
                                <Icon className="mr-1.5 h-3.5 w-3.5" />
                                {kind.label}
                                <span
                                    className={`ml-1.5 text-xs ${
                                        active
                                            ? 'text-primary-foreground/70'
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    {count}
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

                {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                            Теги:
                        </span>
                        {tags.map((tag) => {
                            const active = filters.tag === tag;

                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() =>
                                        applyFilters({
                                            tag: active ? '' : tag,
                                        })
                                    }
                                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                        active
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                    }`}
                                >
                                    #{tag}
                                </button>
                            );
                        })}
                    </div>
                )}

                {notes.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
                        <NotebookPen className="h-10 w-10 text-muted-foreground/40" />
                        <div>
                            <p className="font-medium">
                                {hasFilters
                                    ? 'Ничего не найдено'
                                    : 'Пока нет заметок'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {hasFilters
                                    ? 'Попробуйте изменить запрос или сбросить фильтры.'
                                    : 'Откройте книгу и нажмите «Заметка», чтобы записать мысль, цитату или вопрос.'}
                            </p>
                        </div>
                        {hasFilters ? (
                            <Button variant="outline" onClick={resetFilters}>
                                Сбросить фильтры
                            </Button>
                        ) : (
                            <Button asChild>
                                <Link href="/books">К книгам</Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {notes.data.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                showBook
                                onOpen={() => openNote(note)}
                                onEdit={
                                    note.book
                                        ? () => {
                                              setEditingNote(note);
                                              setComposerOpen(true);
                                          }
                                        : undefined
                                }
                                onDelete={
                                    note.book
                                        ? () => {
                                              void deleteNote(note);
                                          }
                                        : undefined
                                }
                            />
                        ))}
                    </div>
                )}

                {notes.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-1">
                        {notes.links.map((link, index) =>
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

            {editingNote?.book && (
                <NoteComposer
                    open={composerOpen}
                    onOpenChange={setComposerOpen}
                    bookId={editingNote.book.id}
                    bookTitle={editingNote.book.title}
                    page={editingNote.page}
                    section={editingNote.section}
                    suggestedTags={tags}
                    note={editingNote}
                    onSaved={reloadNotes}
                />
            )}
        </>
    );
}
