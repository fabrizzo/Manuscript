import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { destroy as destroyRoute, edit as editRoute } from '@/routes/books';
import type {
    BookListItem,
    Category,
    ContinueReadingBook,
} from '@/types/book';
import { Input } from '@/components/ui/input';
import {
    ArrowRight,
    BookOpen,
    BookPlus,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';

type Paginator<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

type Props = {
    books: Paginator<BookListItem>;
    categories: Category[];
    selectedCategory: string | null;
    continueReading: ContinueReadingBook | null;
    search: string | null;   // ← добавили
    totalBooks: number;   // ← добавили
};

export default function BooksIndex({
    books,
    categories,
    selectedCategory,
    continueReading,
    search,   // ← добавили
    totalBooks,   // ← добавили
}: Props) {
    const [allBooks, setAllBooks] = useState<BookListItem[]>(books.data);
    const [currentPage, setCurrentPage] = useState(books.current_page);
    const [lastPage, setLastPage] = useState(books.last_page);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchInput, setSearchInput] = useState(search ?? '');
    const [bookToDelete, setBookToDelete] = useState<BookListItem | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (books.current_page === 1) {
            setAllBooks(books.data);
            setCurrentPage(1);
            setLastPage(books.last_page);
        }
    }, [books.current_page, books.data, books.last_page]);

    const filterByCategory = (slug: string | null) => {
        router.get(
            '/books',
            {
                ...(slug ? { category: slug } : {}),
                ...(search ? { search } : {}),
            },
            { preserveScroll: true, preserveState: false },
        );
    };

    const performSearch = (value: string) => {
        router.get(
            '/books',
            {
                ...(selectedCategory ? { category: selectedCategory } : {}),
                ...(value ? { search: value } : {}),
            },
            { preserveScroll: true, preserveState: false },
        );
    };

    const loadMore = () => {
        if (loadingMore || currentPage >= lastPage) return;
        setLoadingMore(true);
            router.get(
                '/books',
                {
                    page: currentPage + 1,
                    ...(selectedCategory ? { category: selectedCategory } : {}),
                    ...(search ? { search } : {}),
                },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['books'],
                onSuccess: (page) => {
                    const pag = (
                        page.props as { books: Paginator<BookListItem> }
                    ).books;
                    setAllBooks((prev) => [...prev, ...pag.data]);
                    setCurrentPage(pag.current_page);
                    setLastPage(pag.last_page);
                },
                onFinish: () => setLoadingMore(false),
            },
        );
    };

    const confirmDelete = () => {
        if (!bookToDelete) return;
        const deletedId = bookToDelete.id;
        setDeleting(true);
        router.delete(destroyRoute.url({ book: deletedId }), {
            preserveScroll: true,
            onSuccess: () => {
                setAllBooks((prev) => prev.filter((b) => b.id !== deletedId));
            },
            onFinish: () => {
                setDeleting(false);
                setBookToDelete(null);
            },
        });
    };

    return (
        <>
            <Head title="Мои книги" />

            <div className="space-y-6 p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Мои книги
                        </h1>
                        <p className="text-muted-foreground">
                            {books.total > 0
                                ? `${books.total} ${pluralBooks(books.total)} в библиотеке`
                                : 'Библиотека пока пуста'}
                        </p>
                    </div>

                    <Button asChild>
                        <Link href="/books/create">
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить книгу
                        </Link>
                    </Button>
                </div>

                {/* Поиск */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') performSearch(searchInput.trim());
                        }}
                        onBlur={() => {
                            if (searchInput.trim() !== (search ?? '')) {
                                performSearch(searchInput.trim());
                            }
                        }}
                        placeholder="Поиск по названию или автору…"
                        className="pl-9"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput('');
                                performSearch('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Очистить"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Продолжить чтение */}
                    {continueReading && (
                        <ContinueReadingCard book={continueReading} />
                    )}

                {categories.length > 0 && (
    <div className="flex flex-wrap gap-2">
        <Button
            variant={!selectedCategory ? 'default' : 'outline'}
            size="sm"
            onClick={() => filterByCategory(null)}
        >
            Все
            <span
                className={`ml-1.5 text-xs ${
                    !selectedCategory
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                }`}
            >
                {totalBooks}
            </span>
        </Button>
            {categories
            .filter((cat) => (cat.books_count ?? 0) > 0)
            .map((cat) => (
                        <Button
                            key={cat.id}
                            variant={
                                selectedCategory === cat.slug
                                    ? 'default'
                                    : 'outline'
                            }
                            size="sm"
                            onClick={() => filterByCategory(cat.slug)}
                        >
                            {cat.name}
                            {cat.books_count !== undefined && (
                                <span
                                    className={`ml-1.5 text-xs ${
                                        selectedCategory === cat.slug
                                            ? 'text-primary-foreground/70'
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    {cat.books_count}
                                </span>
                            )}
                        </Button>
                    ))}
                </div>
            )}

                {allBooks.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-16 text-center">
                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-lg font-medium">
                            {selectedCategory
                                ? 'В этой категории пока нет книг'
                                : 'Пока нет книг'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Загрузите первый PDF, чтобы начать читать
                        </p>
                        <Button asChild className="mt-6">
                            <Link href="/books/create">
                                <BookPlus className="mr-2 h-4 w-4" />
                                Загрузить книгу
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* 1 колонка на телефоне, 2 на планшете, 3 на десктопе */}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {allBooks.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    onDelete={() => setBookToDelete(book)}
                                />
                            ))}
                        </div>

                        {currentPage < lastPage && (
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore && (
                                        <Spinner className="mr-2 h-4 w-4" />
                                    )}
                                    Загрузить ещё
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>



            <Dialog
                open={!!bookToDelete}
                onOpenChange={(open) => !open && setBookToDelete(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Удалить книгу?</DialogTitle>
                        <DialogDescription>
                            Книга «{bookToDelete?.title}» и её прогресс будут
                            удалены навсегда. Это действие нельзя отменить.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setBookToDelete(null)}
                            disabled={deleting}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Удаление…' : 'Удалить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

function BookCard({
    book,
    onDelete,
}: {
    book: BookListItem;
    onDelete: () => void;
}) {
    const isNew = (() => {
        const created = new Date(book.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created > weekAgo;
    })();

    const isComplete =
        book.total_pages !== null &&
        book.total_pages > 0 &&
        book.current_page >= book.total_pages;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="group relative flex gap-5 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                    {/* Обложка */}
                    <Link
                        href={`/books/${book.id}`}
                        className="relative h-[220px] w-[150px] shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm"
                    >
                        {book.cover_url ? (
                            <img
                                src={book.cover_url}
                                alt={book.title}
                                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <BookOpen className="h-12 w-12 text-muted-foreground" />
                            </div>
                        )}

                        {isNew && (
                            <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                New
                            </span>
                        )}
                    </Link>

                    {/* Правая часть */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                            href={`/books/${book.id}`}
                            className="flex-1 outline-none"
                        >
                            <h3 className="line-clamp-3 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                                {book.title}
                            </h3>
                            {book.author && (
                                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                                    {book.author}
                                </p>
                            )}
                            {book.category && (
                                <span
                                    className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColor(book.category.id)}`}
                                >
                                    {book.category.name}
                                </span>
                            )}
                        </Link>

                        {/* Прогресс */}
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                    {book.total_pages
                                        ? `стр. ${book.current_page} / ${book.total_pages}`
                                        : `стр. ${book.current_page}`}
                                </span>
                                <span
                                    className={`text-sm font-semibold tabular-nums ${
                                        isComplete
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-foreground'
                                    }`}
                                >
                                    {isComplete
                                        ? '✓ Прочитано'
                                        : `${book.percent_read}%`}
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        isComplete
                                            ? 'bg-emerald-500'
                                            : 'bg-primary'
                                    }`}
                                    style={{
                                        width: `${isComplete ? 100 : book.percent_read}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Кнопки */}
                    <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 shadow-sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.visit(editRoute.url({ book: book.id }));
                            }}
                            aria-label="Редактировать"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 shadow-sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete();
                            }}
                            aria-label="Удалить"
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
                sideOffset={8}
                className="max-w-xs p-3"
            >
                <div className="space-y-1.5 text-xs">
                    {book.pdf_metadata?.title &&
                        book.pdf_metadata.title !== book.title && (
                            <p className="text-muted-foreground">
                                <span className="font-medium">Оригинал:</span>{' '}
                                {book.pdf_metadata.title}
                            </p>
                        )}

                    {book.pdf_metadata?.author && (
                        <p className="text-muted-foreground">
                            <span className="font-medium">Автор PDF:</span>{' '}
                            {book.pdf_metadata.author}
                        </p>
                    )}

                    {book.pdf_metadata?.creationDate && (
                        <p className="text-muted-foreground">
                            <span className="font-medium">Создан:</span>{' '}
                            {formatPdfDate(book.pdf_metadata.creationDate)}
                        </p>
                    )}

                    {book.pdf_metadata?.producer && (
                        <p className="text-muted-foreground">
                            <span className="font-medium">Producer:</span>{' '}
                            {book.pdf_metadata.producer}
                        </p>
                    )}

                    {book.file_size && (
                        <p className="text-muted-foreground">
                            <span className="font-medium">Размер:</span>{' '}
                            {formatBytes(book.file_size)}
                        </p>
                    )}

                    {book.total_pages && (
                        <p className="text-muted-foreground">
                            <span className="font-medium">Страниц:</span>{' '}
                            {book.total_pages}
                        </p>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

function formatLastRead(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHour < 24) return `${diffHour} ч назад`;
    if (diffDay === 1) return 'вчера';
    if (diffDay < 7) return `${diffDay} дн назад`;
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
    });
}

/**
 * Формат PDF-даты: "D:20200515000000+03'00'"
 * → "15 мая 2020"
 */
function formatPdfDate(raw: string): string {
    const m = raw.match(/D:(\d{4})(\d{2})(\d{2})/);
    if (!m) return raw;
    const [, year, month, day] = m;
    const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} ${monthName} ${year}`;
}

/**
 * Формат размера: байты → КБ / МБ
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// Цвета бейджей категорий (по индексу id % N)
const CATEGORY_COLORS = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
];

function getCategoryColor(categoryId: number): string {
    return CATEGORY_COLORS[categoryId % CATEGORY_COLORS.length];
}

function pluralBooks(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'книга';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return 'книги';
    return 'книг';
}

function ContinueReadingCard({ book }: { book: ContinueReadingBook }) {
    return (
        <Link
            href={`/books/${book.id}`}
            className="group block max-w-3xl overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
            <div className="flex gap-5 p-5 md:gap-6 md:p-6">
                {/* Обложка */}
                <div className="relative h-[180px] w-[120px] shrink-0 overflow-hidden rounded-lg border bg-muted shadow-md md:h-[220px] md:w-[150px]">
                    {book.cover_url ? (
                        <img
                            src={book.cover_url}
                            alt={book.title}
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center transition-transform duration-300 ease-out group-hover:scale-105">
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Правая часть */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            <BookOpen className="h-3.5 w-3.5" />
                            Продолжить чтение
                        </div>

                        <h2 className="line-clamp-2 text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary md:text-2xl">
                            {book.title}
                        </h2>

                        {book.author && (
                            <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground md:text-base">
                                {book.author}
                            </p>
                        )}

                        {book.category && (
                            <span
                                className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColor(book.category.id)}`}
                            >
                                {book.category.name}
                            </span>
                        )}
                    </div>

                    {/* Прогресс + кнопка */}
                    <div className="mt-4 max-w-md space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {book.total_pages
                                    ? `Стр. ${book.current_page} из ${book.total_pages}`
                                    : `Стр. ${book.current_page}`}
                                {formatLastRead(book.last_read_at) && (
                                    <span className="ml-2 text-xs opacity-70">
                                        · {formatLastRead(book.last_read_at)}
                                    </span>
                                )}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                                {book.percent_read}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${book.percent_read}%` }}
                            />
                        </div>

                        <Button
                            className="w-full md:w-auto"
                            size="lg"
                        >
                            Продолжить на стр. {book.current_page}
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </Link>
    );
}

BooksIndex.layout = {
    breadcrumbs: [
        {
            title: 'Мои книги',
            href: '/books',
        },
    ],
};