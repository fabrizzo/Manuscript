import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Bookmark as BookmarkIcon,
    BookmarkPlus,
    ChevronLeft,
    ChevronRight,
    Maximize2,
    Minimize2,
    Palette,
    PanelRightClose,
    PanelRightOpen,
    Trash2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    readerThemes,
    useReaderTheme,
    type ReaderTheme,
} from '@/hooks/use-reader-theme';
import type { BookReader, Bookmark } from '@/types/book';
import { progress as progressRoute } from '@/routes/books';
import {
    store as bookmarkStore,
    destroy as bookmarkDestroy,
} from '@/routes/bookmarks';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
    book: BookReader;
    bookmarks: Bookmark[];
};

export default function BooksReader({ book, bookmarks }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfDocRef = useRef<any>(null);
    const renderTaskRef = useRef<any>(null);
    const touchStateRef = useRef<{
        startDist: number;
        startScale: number;
    } | null>(null);

    const [totalPages, setTotalPages] = useState<number>(
        book?.total_pages ?? 0,
    );
    const [currentPage, setCurrentPage] = useState<number>(
        book?.current_page || 1,
    );
    const { theme, setTheme } = useReaderTheme();
    const [scale, setScale] = useState<number>(1.4);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pageInput, setPageInput] = useState<string>(
        String(book?.current_page || 1),
    );

    const [panelOpen, setPanelOpen] = useState(false);
    const [savingBookmark, setSavingBookmark] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const currentBookmark = bookmarks.find((b) => b.page === currentPage);

    // Загрузка PDF
    useEffect(() => {
        if (!book?.file_url) return;
        if (pdfDocRef.current) return;

        let cancelled = false;

        (async () => {
            try {
                setIsLoading(true);
                const pdf = await pdfjsLib.getDocument({
                    url: book.file_url,
                    wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`,
                }).promise;
                if (cancelled) return;
                pdfDocRef.current = pdf;
                setTotalPages(pdf.numPages);

                if (book.total_pages !== pdf.numPages) {
                    router.post(
                        progressRoute.url({ book: book.id }),
                        {
                            current_page: currentPage,
                            total_pages: pdf.numPages,
                        },
                        { preserveScroll: true, preserveState: true },
                    );
                }
            } catch (e) {
                if (cancelled) return;
                console.error('PDF load error:', e);
                setError('Не удалось загрузить PDF.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book?.file_url, book?.id]);

    const renderPage = useCallback(
        async (pageNum: number) => {
            const pdf = pdfDocRef.current;
            const canvas = canvasRef.current;
            if (!pdf || !canvas) return;

            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        // ignore
                    }
                }

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const task = page.render({
                    canvasContext: ctx,
                    viewport,
                });
                renderTaskRef.current = task;
                await task.promise;
            } catch (e: any) {
                if (e?.name !== 'RenderingCancelledException') {
                    console.error('Render error:', e);
                }
            }
        },
        [scale],
    );

    useEffect(() => {
        if (!isLoading && pdfDocRef.current) {
            renderPage(currentPage);
        }
    }, [currentPage, scale, isLoading, renderPage]);

    useEffect(() => {
        if (isLoading || !book?.id) return;
        const t = setTimeout(() => {
            router.post(
                progressRoute.url({ book: book.id }),
                { current_page: currentPage },
                { preserveScroll: true, preserveState: true },
            );
        }, 1500);
        return () => clearTimeout(t);
    }, [currentPage, isLoading, book?.id]);

    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    // Клавиатура
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === 'ArrowLeft') {
                setCurrentPage((p) => Math.max(1, p - 1));
            } else if (e.key === 'ArrowRight') {
                setCurrentPage((p) =>
                    totalPages ? Math.min(totalPages, p + 1) : p + 1,
                );
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totalPages]);

    // Fullscreen
    useEffect(() => {
        const onFsChange = () => {
            const isFs = !!document.fullscreenElement;
            setIsFullscreen(isFs);
            document.documentElement.classList.toggle(
                'reader-fullscreen',
                isFs,
            );
        };
        document.addEventListener('fullscreenchange', onFsChange);
        onFsChange();
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.documentElement.classList.remove('reader-fullscreen');
        };
    }, []);

    // Pinch-to-zoom
    useEffect(() => {
        const el = canvasRef.current?.parentElement;
        if (!el) return;

        const getDist = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                touchStateRef.current = {
                    startDist: getDist(e.touches),
                    startScale: scale,
                };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchStateRef.current) {
                e.preventDefault();
                const ratio =
                    getDist(e.touches) / touchStateRef.current.startDist;
                const newScale = Math.min(
                    Math.max(0.5, touchStateRef.current.startScale * ratio),
                    4,
                );
                setScale(newScale);
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                touchStateRef.current = null;
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [scale]);

    const goToPage = (n: number) => {
        const clamped = Math.min(Math.max(1, n), totalPages || 1);
        setCurrentPage(clamped);
    };

    const zoom = (delta: number) => {
        setScale((s) => Math.min(Math.max(0.5, s + delta), 4));
    };

    const submitPageInput = () => {
        const n = parseInt(pageInput, 10);
        if (!isNaN(n)) goToPage(n);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen();
        }
    };

    const addBookmark = () => {
        if (!book?.id || savingBookmark) return;

        const label = prompt(
            `Метка для стр. ${currentPage} (необязательно):`,
            currentBookmark?.label ?? '',
        );

        if (label === null) return;

        setSavingBookmark(true);
        router.post(
            bookmarkStore.url({ book: book.id }),
            { page: currentPage, label: label || null },
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setSavingBookmark(false),
            },
        );
    };

    const deleteBookmark = (bookmarkId: number) => {
        if (!book?.id) return;
        router.delete(
            bookmarkDestroy.url({ book: book.id, bookmark: bookmarkId }),
            { preserveScroll: true, preserveState: true },
        );
    };

    const goToBookmark = (page: number) => {
        goToPage(page);
        setPanelOpen(false);
    };

    if (!book) {
        return (
            <>
                <Head title="Ошибка" />
                <div className="p-6">
                    <p className="text-destructive">
                        Данные книги не загрузились.
                    </p>
                    <Link href="/books" className="mt-4 inline-block underline">
                        ← К списку книг
                    </Link>
                </div>
            </>
        );
    }

    const progressPercent =
        totalPages > 0
            ? Math.round((currentPage / totalPages) * 100)
            : 0;

    return (
        <>
            <Head title={book.title} />

            <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-stone-100 dark:bg-stone-950 sm:h-[calc(100vh-4rem)]">
                {/* Тулбар */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-2 py-1.5 text-foreground sm:gap-3 sm:px-4 sm:py-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="px-2 sm:px-3"
                    >
                        <Link href="/books">
                            <ArrowLeft className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Назад</span>
                        </Link>
                    </Button>

                    <div className="mx-1 h-5 w-px bg-border sm:mx-2 sm:h-6" />

                    <div className="flex items-center gap-1 text-sm">
                        <Input
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value)}
                            onBlur={submitPageInput}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    submitPageInput();
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            className="h-8 w-12 text-center text-xs sm:w-16 sm:text-sm"
                        />
                        <span className="text-xs text-muted-foreground sm:text-sm">
                            / {totalPages || '…'}
                        </span>
                    </div>

                    <div className="mx-1 h-5 w-px bg-border sm:mx-2 sm:h-6" />

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => zoom(-0.2)}
                            disabled={scale <= 0.5}
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="hidden min-w-[3rem] text-center text-xs text-muted-foreground sm:inline sm:text-sm">
                            {Math.round(scale * 100)}%
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => zoom(0.2)}
                            disabled={scale >= 4}
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mx-1 h-5 w-px bg-border sm:mx-2 sm:h-6" />

                    <Button
                        variant={currentBookmark ? 'default' : 'outline'}
                        size="sm"
                        className="px-2 sm:px-3"
                        onClick={addBookmark}
                        disabled={savingBookmark}
                        title={
                            currentBookmark
                                ? 'Изменить метку закладки'
                                : 'Добавить закладку'
                        }
                    >
                        {currentBookmark ? (
                            <BookmarkIcon className="h-4 w-4 fill-current sm:mr-2" />
                        ) : (
                            <BookmarkPlus className="h-4 w-4 sm:mr-2" />
                        )}
                        <span className="hidden sm:inline">Закладка</span>
                    </Button>

                    <Button
                        variant={panelOpen ? 'default' : 'outline'}
                        size="sm"
                        className="px-2 sm:px-3"
                        onClick={() => setPanelOpen(!panelOpen)}
                        title="Панель закладок"
                    >
                        {panelOpen ? (
                            <PanelRightClose className="h-4 w-4 sm:mr-2" />
                        ) : (
                            <PanelRightOpen className="h-4 w-4 sm:mr-2" />
                        )}
                        <span className="hidden sm:inline">Панель</span>
                        {bookmarks.length > 0 && (
                            <span className="ml-1 rounded-full bg-background px-1.5 text-xs text-foreground sm:ml-2">
                                {bookmarks.length}
                            </span>
                        )}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="px-2 sm:px-3"
                                title="Цвет фона"
                            >
                                <Palette className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Фон</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Цвет фона</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(Object.keys(readerThemes) as ReaderTheme[]).map(
                                (key) => (
                                    <DropdownMenuItem
                                        key={key}
                                        onClick={() => setTheme(key)}
                                        className="flex items-center gap-2"
                                    >
                                        <span
                                            className="h-4 w-4 rounded border border-border"
                                            style={{
                                                background:
                                                    readerThemes[key].preview,
                                            }}
                                        />
                                        <span>{readerThemes[key].name}</span>
                                        {theme === key && (
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                ✓
                                            </span>
                                        )}
                                    </DropdownMenuItem>
                                ),
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleFullscreen}
                        title={
                            isFullscreen
                                ? 'Выйти из полноэкранного'
                                : 'Полный экран'
                        }
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Название книги */}
                <div className="border-b border-border bg-card px-3 py-1.5 sm:px-4 sm:py-2">
                    <p className="truncate text-center text-xs font-medium text-foreground sm:text-sm">
                        {book.title}
                        {book.author && (
                            <span className="text-muted-foreground">
                                {' '}
                                — {book.author}
                            </span>
                        )}
                    </p>
                </div>

                {/* Основная область */}
                <div className="flex flex-1 overflow-hidden">
                    <div className="relative flex-1 overflow-hidden">
                        {/* Левая кнопка */}
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-1/2 left-1 z-20 h-10 w-10 -translate-y-1/2 rounded-full opacity-70 shadow-lg transition-opacity hover:opacity-100 sm:left-4 sm:h-12 sm:w-12"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1 || isLoading}
                            aria-label="Предыдущая страница"
                        >
                            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>

                        {/* Правая кнопка */}
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-1/2 right-1 z-20 h-10 w-10 -translate-y-1/2 rounded-full opacity-70 shadow-lg transition-opacity hover:opacity-100 sm:right-4 sm:h-12 sm:w-12"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={
                                (totalPages > 0 &&
                                    currentPage >= totalPages) ||
                                isLoading
                            }
                            aria-label="Следующая страница"
                        >
                            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>

                        <div
                            className={`h-full overflow-auto p-2 transition-colors sm:p-4 ${readerThemes[theme].wrapper}`}
                        >
                            {error ? (
                                <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-6 text-center">
                                    <p className="text-destructive">
                                        {error}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={() =>
                                            window.location.reload()
                                        }
                                    >
                                        Попробовать снова
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex justify-center">
                                    <canvas
                                        ref={canvasRef}
                                        className={`rounded border bg-white shadow-lg ${readerThemes[theme].canvasBorder}`}
                                        style={{
                                            display: isLoading
                                                ? 'none'
                                                : 'block',
                                        }}
                                    />
                                </div>
                            )}

                            {isLoading && !error && (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    Загрузка PDF…
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Правая панель с закладками */}
                    {panelOpen && (
                        <aside className="absolute inset-y-0 right-0 z-30 flex w-72 max-w-[85vw] shrink-0 flex-col border-l border-border bg-card sm:relative sm:inset-auto sm:max-w-none">
                            <div className="flex items-center justify-between border-b border-border px-4 py-2">
                                <h2 className="text-sm font-semibold">
                                    Закладки
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setPanelOpen(false)}
                                >
                                    <PanelRightClose className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-auto p-2">
                                {bookmarks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                                        <BookmarkIcon className="h-8 w-8 opacity-40" />
                                        <p>Пока нет закладок</p>
                                        <p className="text-xs">
                                            Нажмите 🔖 в панели, чтобы
                                            добавить
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="space-y-1">
                                        {bookmarks.map((bm) => (
                                            <li
                                                key={bm.id}
                                                className="group flex items-start gap-2 rounded-md p-2 hover:bg-accent"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        goToBookmark(bm.page)
                                                    }
                                                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                                                >
                                                    <span className="text-xs font-medium text-foreground">
                                                        Стр. {bm.page}
                                                    </span>
                                                    {bm.label && (
                                                        <span className="line-clamp-2 text-xs text-muted-foreground">
                                                            {bm.label}
                                                        </span>
                                                    )}
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                                                    onClick={() =>
                                                        deleteBookmark(bm.id)
                                                    }
                                                    aria-label="Удалить закладку"
                                                >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </aside>
                    )}
                </div>

                {/* Нижняя панель прогресса */}
                <div className="border-t border-border bg-card px-3 py-0.5 sm:px-4 sm:py-1">
                    <div className="flex items-center gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
                        <span className="min-w-[70px] whitespace-nowrap text-muted-foreground sm:min-w-[90px]">
                            Стр.{' '}
                            <span className="font-medium text-foreground">
                                {currentPage}
                            </span>{' '}
                            из {totalPages || '…'}
                        </span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="min-w-[35px] text-right tabular-nums text-muted-foreground sm:min-w-[40px]">
                            {progressPercent}%
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}

BooksReader.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
    ],
};