import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Bookmark as BookmarkIcon,
    BookmarkPlus,
    ChevronLeft,
    ChevronRight,
    Code2,
    ListTree,
    Maximize2,
    Minimize2,
    MoveHorizontal,
    NotebookPen,
    Palette,
    PanelRightClose,
    PanelRightOpen,
    Plus,
    Quote,
    Trash2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { NoteCard } from '@/components/notes/note-card';
import { NoteComposer } from '@/components/notes/note-composer';
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
import type { Note, NoteKind } from '@/types/note';
import { progress as progressRoute } from '@/routes/books';
import {
    store as bookmarkStore,
    destroy as bookmarkDestroy,
} from '@/routes/bookmarks';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
    book: BookReader;
    initialPage: number;
    bookmarks: Bookmark[];
    notes: Note[];
    tagSuggestions: string[];
};

type TocEntry = {
    title: string;
    page: number | null;
    children: TocEntry[];
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const DEFAULT_SCALE = 1.4;
const ZOOM_STEP = 0.05;

/**
 * На ПК по умолчанию читаем в ручном масштабе (140 %), на телефонах
 * и планшетах — вписываем страницу по ширине.
 */
const shouldAutoFit = () =>
    typeof window !== 'undefined' &&
    !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Превращает пункт PDF-оглавления в номер страницы.
 * pdf.js умеет хранить назначение либо готовым массивом, либо строкой-именем.
 */
async function resolveDestinationPage(
    pdf: any,
    destination: any,
): Promise<number | null> {
    try {
        const dest =
            typeof destination === 'string'
                ? await pdf.getDestination(destination)
                : destination;

        if (!Array.isArray(dest) || dest.length === 0) return null;

        const ref = dest[0];
        if (typeof ref === 'number') return ref + 1;

        const pageIndex = await pdf.getPageIndex(ref);
        return pageIndex + 1;
    } catch {
        return null;
    }
}

/** Рекурсивно строит дерево оглавления, подставляя номера страниц. */
async function buildToc(
    pdf: any,
    items: any[],
    depth = 0,
): Promise<TocEntry[]> {
    if (!Array.isArray(items) || items.length === 0 || depth > 8) return [];

    return Promise.all(
        items.map(async (item) => ({
            title: String(item?.title ?? 'Без названия').trim(),
            page: await resolveDestinationPage(pdf, item?.dest),
            children: await buildToc(pdf, item?.items, depth + 1),
        })),
    );
}

function TocList({
    entries,
    currentPage,
    onSelect,
    depth = 0,
}: {
    entries: TocEntry[];
    currentPage: number;
    onSelect: (page: number) => void;
    depth?: number;
}) {
    return (
        <ul className={depth > 0 ? 'ml-2 border-l border-border pl-1' : ''}>
            {entries.map((entry, index) => {
                const isActive = entry.page === currentPage;

                return (
                    <li key={`${depth}-${index}-${entry.title}`}>
                        <button
                            type="button"
                            onClick={() => entry.page && onSelect(entry.page)}
                            disabled={!entry.page}
                            className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                                isActive
                                    ? 'bg-accent font-medium text-accent-foreground'
                                    : 'hover:bg-accent/60'
                            } ${entry.page ? '' : 'cursor-default opacity-60'}`}
                        >
                            <span className="min-w-0 flex-1 leading-snug">
                                {entry.title}
                            </span>
                            {entry.page && (
                                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                    {entry.page}
                                </span>
                            )}
                        </button>
                        {entry.children.length > 0 && (
                            <TocList
                                entries={entry.children}
                                currentPage={currentPage}
                                onSelect={onSelect}
                                depth={depth + 1}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

const sortNotes = (items: Note[]) =>
    [...items].sort((a, b) => a.page - b.page || b.id - a.id);

export default function BooksReader({
    book,
    initialPage,
    bookmarks,
    notes: initialNotes,
    tagSuggestions,
}: Props) {
    const startPage = Math.max(1, initialPage || book?.current_page || 1);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const textLayerTaskRef = useRef<any>(null);
    const viewerRef = useRef<HTMLDivElement>(null);
    const pdfDocRef = useRef<any>(null);
    const renderTaskRef = useRef<any>(null);
    const renderIdRef = useRef(0);
    const effectiveScaleRef = useRef(1.4);
    const currentPageRef = useRef<number>(startPage);
    const lastSavedRef = useRef<number>(book?.current_page || 0);
    const touchStateRef = useRef<{
        startDist: number;
        startScale: number;
    } | null>(null);

    const [totalPages, setTotalPages] = useState<number>(
        book?.total_pages ?? 0,
    );
    const [currentPage, setCurrentPage] = useState<number>(startPage);
    const { theme, setTheme } = useReaderTheme();
    const [scale, setScale] = useState<number>(DEFAULT_SCALE);
    const [renderedScale, setRenderedScale] = useState<number>(DEFAULT_SCALE);
    const [autoFit, setAutoFit] = useState<boolean>(() => shouldAutoFit());
    const [viewerWidth, setViewerWidth] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pageInput, setPageInput] = useState<string>(String(startPage));

    const [panelOpen, setPanelOpen] = useState(false);
    const [panelTab, setPanelTab] = useState<'toc' | 'bookmarks' | 'notes'>(
        'toc',
    );
    const [toc, setToc] = useState<TocEntry[]>([]);
    const [tocLoading, setTocLoading] = useState(true);
    const [savingBookmark, setSavingBookmark] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [notes, setNotes] = useState<Note[]>(() =>
        sortNotes(initialNotes ?? []),
    );
    const [noteComposerOpen, setNoteComposerOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [noteDraft, setNoteDraft] = useState<{
        kind: NoteKind;
        body: string;
    } | null>(null);
    const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

    const currentBookmark = bookmarks.find((b) => b.page === currentPage);

    const currentSection = useMemo(() => {
        const flat: TocEntry[] = [];
        const walk = (items: TocEntry[]) => {
            for (const item of items) {
                flat.push(item);
                walk(item.children);
            }
        };
        walk(toc);

        let title: string | null = null;
        let page = 0;
        for (const entry of flat) {
            if (
                entry.page &&
                entry.page <= currentPage &&
                entry.page >= page
            ) {
                page = entry.page;
                title = entry.title;
            }
        }

        return title;
    }, [toc, currentPage]);

    const groupedNotes = useMemo(() => {
        const groups = new Map<number, Note[]>();
        for (const note of notes) {
            const list = groups.get(note.page);
            if (list) {
                list.push(note);
            } else {
                groups.set(note.page, [note]);
            }
        }

        return [...groups.entries()].sort((a, b) => a[0] - b[0]);
    }, [notes]);

    const noteCount = notes.length;

    /**
     * Сохраняем прогресс обычным fetch с keepalive: страница не перезагружается,
     * запрос доживёт до закрытия вкладки. Сервер отвечает 204.
     */
    const saveProgress = useCallback(
        (page: number, pages?: number) => {
            if (!book?.id || page < 1) return;

            const token =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';

            const payload: Record<string, number | string> = {
                current_page: page,
            };
            if (pages) payload.total_pages = pages;
            if (token) payload._token = token;

            fetch(progressRoute.url({ book: book.id }), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify(payload),
                credentials: 'same-origin',
                keepalive: true,
            }).catch(() => {
                // Молча: прогресс не критичен для чтения.
            });
        },
        [book?.id],
    );


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

                if (cancelled) {
                    pdf.destroy();
                    return;
                }

                pdfDocRef.current = pdf;
                setTotalPages(pdf.numPages);

                if (book.total_pages !== pdf.numPages) {
                    saveProgress(currentPageRef.current, pdf.numPages);
                }

                // Оглавление строим после того, как книга уже открылась:
                // большие PDF не должны ждать резолва всех destination.
                pdf.getOutline()
                    .then(async (outline: any[] | null) => {
                        if (cancelled) return;
                        if (!outline?.length) {
                            setToc([]);
                            return;
                        }
                        const entries = await buildToc(pdf, outline);
                        if (!cancelled) setToc(entries);
                    })
                    .catch((e: unknown) => {
                        console.warn('TOC error:', e);
                    })
                    .finally(() => {
                        if (!cancelled) setTocLoading(false);
                    });
            } catch (e) {
                if (cancelled) return;
                console.error('PDF load error:', e);
                setError('Не удалось загрузить PDF.');
                setTocLoading(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            const pdf = pdfDocRef.current;
            pdfDocRef.current = null;
            try {
                pdf?.destroy?.();
            } catch {
                // ignore
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book?.file_url, book?.id]);

    const renderPage = useCallback(
        async (pageNum: number) => {
            const pdf = pdfDocRef.current;
            const canvas = canvasRef.current;
            if (!pdf || !canvas) return;

            const renderId = ++renderIdRef.current;

            try {
                const page = await pdf.getPage(pageNum);
                if (renderId !== renderIdRef.current) return;

                const baseViewport = page.getViewport({ scale: 1 });
                const availableWidth = Math.max(viewerWidth - 2, 120);
                const fitScale = clamp(
                    availableWidth / baseViewport.width,
                    MIN_SCALE,
                    MAX_SCALE,
                );
                const effectiveScale = autoFit ? fitScale : scale;
                effectiveScaleRef.current = effectiveScale;
                setRenderedScale(effectiveScale);

                // Рисуем в физических пикселях, а на экране показываем
                // логический размер — так текст остаётся резким на HiDPI.
                const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
                const viewport = page.getViewport({
                    scale: effectiveScale * dpr,
                });
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        // ignore
                    }
                }

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${Math.floor(baseViewport.width * effectiveScale)}px`;
                canvas.style.height = `${Math.floor(baseViewport.height * effectiveScale)}px`;

                const task = page.render({
                    canvasContext: ctx,
                    viewport,
                });
                renderTaskRef.current = task;
                await task.promise;

                if (renderId !== renderIdRef.current) return;

                // Прозрачный текстовый слой поверх canvas: выделение,
                // копирование и будущие цитаты.
                const textLayer = textLayerRef.current;
                if (textLayer) {
                    try {
                        textLayerTaskRef.current?.cancel?.();
                    } catch {
                        // ignore
                    }

                    textLayer.innerHTML = '';

                    const cssViewport = page.getViewport({
                        scale: effectiveScale,
                    });
                    const textContent = await page.getTextContent();

                    if (renderId !== renderIdRef.current) return;

                    const textLayerTask = new (pdfjsLib as any).TextLayer({
                        textContentSource: textContent,
                        container: textLayer,
                        viewport: cssViewport,
                    });
                    textLayerTaskRef.current = textLayerTask;
                    await textLayerTask.render();
                }
            } catch (e: any) {
                if (e?.name !== 'RenderingCancelledException') {
                    console.error('Render error:', e);
                }
            }
        },
        [autoFit, scale, viewerWidth],
    );

    useEffect(() => {
        if (!isLoading && pdfDocRef.current) {
            renderPage(currentPage);
        }
    }, [currentPage, isLoading, renderPage]);

    // Ширина области чтения: авто-вписывание и перерисовка при ресайзе/панели.
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;

        const measure = () => {
            const styles = window.getComputedStyle(el);
            const padding =
                (parseFloat(styles.paddingLeft) || 0) +
                (parseFloat(styles.paddingRight) || 0);
            setViewerWidth(Math.max(0, el.clientWidth - padding));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    // Дебаунс сохранения прогресса: без Inertia-запроса и перезагрузки props.
    useEffect(() => {
        if (!book?.id) return;
        if (currentPage === lastSavedRef.current) return;

        const t = setTimeout(() => {
            lastSavedRef.current = currentPage;
            saveProgress(currentPage);
        }, 800);

        return () => clearTimeout(t);
    }, [currentPage, book?.id, saveProgress]);

    // Досохраняем при уходе со страницы и в фоне вкладки.
    useEffect(() => {
        const flush = () => {
            const page = currentPageRef.current;
            if (!book?.id || page < 1) return;
            if (page === lastSavedRef.current) return;
            lastSavedRef.current = page;
            saveProgress(page);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flush();
        };

        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange,
            );
            flush();
        };
    }, [book?.id, saveProgress]);

    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    const zoom = useCallback(
        (delta: number) => {
            const base = autoFit ? effectiveScaleRef.current : scale;
            setAutoFit(false);
            setScale(clamp(base + delta, MIN_SCALE, MAX_SCALE));
        },
        [autoFit, scale],
    );

    // Клавиатура: ←/→ — страницы, ↑/↓ — масштаб с шагом 5 %
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === 'ArrowLeft') {
                setCurrentPage((p) => Math.max(1, p - 1));
            } else if (e.key === 'ArrowRight') {
                setCurrentPage((p) =>
                    totalPages ? Math.min(totalPages, p + 1) : p + 1,
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                zoom(ZOOM_STEP);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                zoom(-ZOOM_STEP);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totalPages, zoom]);

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
                    startScale: effectiveScaleRef.current,
                };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchStateRef.current) {
                e.preventDefault();
                const ratio =
                    getDist(e.touches) / touchStateRef.current.startDist;
                const newScale = clamp(
                    touchStateRef.current.startScale * ratio,
                    MIN_SCALE,
                    MAX_SCALE,
                );
                setAutoFit(false);
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
    }, []);

    const goToPage = (n: number) => {
        window.getSelection()?.removeAllRanges();
        setSelectedQuote(null);
        const clamped = Math.min(Math.max(1, n), totalPages || 1);
        setCurrentPage(clamped);
    };

    const toggleAutoFit = () => {
        if (autoFit) {
            // Выключаем вписывание и возвращаем привычный масштаб для ПК,
            // а не текущий «330 %», который получился из ширины окна.
            setScale(DEFAULT_SCALE);
            setAutoFit(false);
        } else {
            setAutoFit(true);
        }
    };

    const openToc = () => {
        setPanelTab('toc');
        setPanelOpen(true);
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

    const goToTocEntry = (page: number) => {
        goToPage(page);
        if (window.innerWidth < 640) setPanelOpen(false);
    };

    const openNoteComposer = useCallback(() => {
        setEditingNote(null);
        setNoteDraft(null);
        setPanelTab('notes');
        setPanelOpen(true);
        setNoteComposerOpen(true);
    }, []);

    const openQuoteComposer = (text: string) => {
        window.getSelection()?.removeAllRanges();
        setSelectedQuote(null);
        setEditingNote(null);
        setNoteDraft({ kind: 'quote', body: text });
        setPanelTab('notes');
        setPanelOpen(true);
        setNoteComposerOpen(true);
    };

    const editNote = (note: Note) => {
        setEditingNote(note);
        setPanelTab('notes');
        setPanelOpen(true);
        setNoteComposerOpen(true);
    };

    const handleNoteSaved = (saved: Note) => {
        setNotes((prev) => {
            const exists = prev.some((note) => note.id === saved.id);
            return sortNotes(
                exists
                    ? prev.map((note) =>
                          note.id === saved.id ? { ...note, ...saved } : note,
                      )
                    : [...prev, saved],
            );
        });
        setEditingNote(null);
        setNoteDraft(null);
    };

    const deleteNote = async (note: Note) => {
        if (!book?.id) return;
        if (!window.confirm('Удалить заметку? Это действие нельзя отменить.')) {
            return;
        }

        const token =
            document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content ?? '';

        try {
            const response = await fetch(
                `/books/${book.id}/notes/${note.id}`,
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

            setNotes((prev) => prev.filter((item) => item.id !== note.id));
            toast.success('Заметка удалена');
        } catch (e) {
            toast.error(
                e instanceof Error ? e.message : 'Не удалось удалить заметку',
            );
        }
    };

    const goToNote = (note: Note) => {
        goToPage(note.page);
        if (window.innerWidth < 640) setPanelOpen(false);
    };

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (noteComposerOpen) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;

            const target = event.target as HTMLElement | null;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable
            ) {
                return;
            }

            if (
                event.key === 'n' ||
                event.key === 'N' ||
                event.key === 'т' ||
                event.key === 'Т'
            ) {
                event.preventDefault();
                openNoteComposer();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [noteComposerOpen, openNoteComposer]);

    // Выделение текста в PDF → кнопка «В заметку».
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;

        const captureSelection = () => {
            window.setTimeout(() => {
                const selection = window.getSelection();

                if (
                    !selection ||
                    selection.isCollapsed ||
                    selection.rangeCount === 0
                ) {
                    setSelectedQuote(null);
                    return;
                }

                const range = selection.getRangeAt(0);
                if (!el.contains(range.commonAncestorContainer)) {
                    setSelectedQuote(null);
                    return;
                }

                const text = selection.toString().trim();
                setSelectedQuote(text.length >= 2 ? text.slice(0, 2000) : null);
            }, 0);
        };

        const onSelectionChange = () => {
            const selection = window.getSelection();
            if (
                !selection ||
                selection.isCollapsed ||
                !selection.toString().trim()
            ) {
                setSelectedQuote(null);
            }
        };

        el.addEventListener('mouseup', captureSelection);
        el.addEventListener('touchend', captureSelection);
        document.addEventListener('selectionchange', onSelectionChange);

        return () => {
            el.removeEventListener('mouseup', captureSelection);
            el.removeEventListener('touchend', captureSelection);
            document.removeEventListener(
                'selectionchange',
                onSelectionChange,
            );
        };
    }, []);

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

    // В полноэкранном режиме прячем отдельную строку с названием и
    // сжимаем тулбар примерно на 30 %, чтобы осталась одна полоска.
    const compact = isFullscreen;
    const toolbarIcon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
    const toolbarIconBtn = compact ? 'h-7 w-7' : 'h-8 w-8';
    const toolbarSmBtn = compact
        ? 'h-7 gap-1 px-1.5 text-xs sm:px-2'
        : 'px-2 sm:px-3';
    const toolbarDivider = compact
        ? 'mx-0.5 h-4 w-px'
        : 'mx-1 h-5 w-px sm:mx-2 sm:h-6';

    return (
        <>
            <Head title={book.title} />

            <div
                className={`flex flex-none flex-col overflow-hidden bg-stone-100 dark:bg-stone-950 ${
                    isFullscreen
                        ? 'h-[100dvh]'
                        : 'h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]'
                }`}
            >
                {/* Тулбар */}
                <div
                    className={`flex items-center border-b border-border bg-card text-foreground ${
                        compact
                            ? 'flex-nowrap gap-1 overflow-x-auto px-1.5 py-1 [&>*]:shrink-0'
                            : 'flex-wrap gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2'
                    }`}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className={toolbarSmBtn}
                    >
                        <Link href="/books">
                            <ArrowLeft className={toolbarIcon} />
                            <span className="hidden sm:inline">Назад</span>
                        </Link>
                    </Button>

                    <div className={`${toolbarDivider} bg-border`} />

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
                            className={`text-center ${
                                compact
                                    ? 'h-7 w-11 text-xs'
                                    : 'h-8 w-12 text-xs sm:w-16 sm:text-sm'
                            }`}
                        />
                        <span
                            className={`text-muted-foreground ${
                                compact
                                    ? 'hidden text-xs sm:inline'
                                    : 'text-xs sm:text-sm'
                            }`}
                        >
                            / {totalPages || '…'}
                        </span>
                    </div>

                    <div className={`${toolbarDivider} bg-border`} />

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className={toolbarIconBtn}
                            onClick={() => zoom(-ZOOM_STEP)}
                            disabled={!autoFit && scale <= MIN_SCALE}
                            title="Уменьшить (↓)"
                        >
                            <ZoomOut className={toolbarIcon} />
                        </Button>
                        <span className="hidden min-w-[3rem] text-center text-xs text-muted-foreground sm:inline sm:text-sm">
                            {Math.round(renderedScale * 100)}%
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className={toolbarIconBtn}
                            onClick={() => zoom(ZOOM_STEP)}
                            disabled={!autoFit && scale >= MAX_SCALE}
                            title="Увеличить (↑)"
                        >
                            <ZoomIn className={toolbarIcon} />
                        </Button>
                        <Button
                            variant={autoFit ? 'default' : 'outline'}
                            size="icon"
                            className={toolbarIconBtn}
                            onClick={toggleAutoFit}
                            title={
                                autoFit
                                    ? 'По ширине окна (включено)'
                                    : 'Вписать по ширине'
                            }
                        >
                            <MoveHorizontal className={toolbarIcon} />
                        </Button>
                    </div>

                    <div className={`${toolbarDivider} bg-border`} />

                    <Button
                        variant={currentBookmark ? 'default' : 'outline'}
                        size="sm"
                        className={toolbarSmBtn}
                        onClick={addBookmark}
                        disabled={savingBookmark}
                        title={
                            currentBookmark
                                ? 'Изменить метку закладки'
                                : 'Добавить закладку'
                        }
                    >
                        {currentBookmark ? (
                            <BookmarkIcon
                                className={`${toolbarIcon} fill-current sm:mr-1`}
                            />
                        ) : (
                            <BookmarkPlus
                                className={`${toolbarIcon} sm:mr-1`}
                            />
                        )}
                        <span className="hidden sm:inline">Закладка</span>
                    </Button>

                    <Button
                        variant={
                            panelOpen && panelTab === 'notes'
                                ? 'default'
                                : 'outline'
                        }
                        size="sm"
                        className={toolbarSmBtn}
                        onClick={openNoteComposer}
                        title="Добавить заметку (N)"
                    >
                        <NotebookPen className={`${toolbarIcon} sm:mr-1`} />
                        <span className="hidden sm:inline">Заметка</span>
                        {noteCount > 0 && (
                            <span className="ml-1 hidden rounded-full bg-muted px-1.5 text-[10px] text-foreground sm:inline">
                                {noteCount}
                            </span>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className={toolbarSmBtn}
                        asChild
                        title="Справочник команд и кода"
                    >
                        <Link href={`/books/${book.id}/reference`}>
                            <Code2 className={`${toolbarIcon} sm:mr-1`} />
                            <span className="hidden sm:inline">
                                Справочник
                            </span>
                            {(book.snippets_count ?? 0) > 0 && (
                                <span className="ml-1 hidden rounded-full bg-muted px-1.5 text-[10px] text-foreground sm:inline">
                                    {book.snippets_count}
                                </span>
                            )}
                        </Link>
                    </Button>

                    <Button
                        variant={
                            panelOpen && panelTab === 'toc'
                                ? 'default'
                                : 'outline'
                        }
                        size="sm"
                        className={toolbarSmBtn}
                        onClick={openToc}
                        title="Оглавление"
                    >
                        <ListTree className={`${toolbarIcon} sm:mr-1`} />
                        <span className="hidden sm:inline">Оглавление</span>
                    </Button>

                    <Button
                        variant={panelOpen ? 'default' : 'outline'}
                        size="sm"
                        className={toolbarSmBtn}
                        onClick={() => setPanelOpen(!panelOpen)}
                        title="Панель навигации"
                    >
                        {panelOpen ? (
                            <PanelRightClose
                                className={`${toolbarIcon} sm:mr-1`}
                            />
                        ) : (
                            <PanelRightOpen
                                className={`${toolbarIcon} sm:mr-1`}
                            />
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
                                className={toolbarSmBtn}
                                title="Цвет фона"
                            >
                                <Palette className={`${toolbarIcon} sm:mr-1`} />
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
                        className={toolbarIconBtn}
                        onClick={toggleFullscreen}
                        title={
                            isFullscreen
                                ? 'Выйти из полноэкранного'
                                : 'Полный экран'
                        }
                    >
                        {isFullscreen ? (
                            <Minimize2 className={toolbarIcon} />
                        ) : (
                            <Maximize2 className={toolbarIcon} />
                        )}
                    </Button>
                </div>

                {/* Название книги (в полном экране скрыто — остаётся одна полоска) */}
                {!isFullscreen && (
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
                )}

                {/* Основная область */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
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
                            ref={viewerRef}
                            className={`h-full overflow-auto transition-colors ${compact ? 'p-1 sm:p-2' : 'p-2 sm:p-4'} ${readerThemes[theme].wrapper}`}
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
                                <div className="flex w-max min-w-full justify-center">
                                    <div
                                        className={`relative inline-block overflow-hidden rounded border bg-white shadow-lg ${readerThemes[theme].canvasBorder}`}
                                        style={{
                                            display: isLoading
                                                ? 'none'
                                                : 'block',
                                        }}
                                    >
                                        <canvas
                                            ref={canvasRef}
                                            className="block"
                                        />
                                        <div
                                            ref={textLayerRef}
                                            className="textLayer"
                                        />
                                    </div>
                                </div>
                            )}

                            {isLoading && !error && (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    Загрузка PDF…
                                </div>
                            )}
                        </div>

                        {selectedQuote && !noteComposerOpen && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
                                <Button
                                    className="pointer-events-auto shadow-lg"
                                    onClick={() =>
                                        openQuoteComposer(selectedQuote)
                                    }
                                >
                                    <Quote className="mr-1.5 h-4 w-4" />
                                    В заметку
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Правая панель с закладками */}
                    {panelOpen && (
                        <aside
                            className={`absolute inset-y-0 right-0 z-30 flex max-w-[85vw] shrink-0 flex-col border-l border-border bg-card sm:relative sm:inset-auto sm:max-w-none ${
                                panelTab === 'notes'
                                    ? 'w-80 sm:w-96'
                                    : 'w-72'
                            }`}
                        >
                            <div className="flex items-center justify-between border-b border-border px-4 py-2">
                                <h2 className="text-sm font-semibold">
                                    Навигация
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

                            <div className="flex border-b border-border text-xs">
                                <button
                                    type="button"
                                    onClick={() => setPanelTab('toc')}
                                    className={`flex flex-1 items-center justify-center gap-1 px-1.5 py-2 transition-colors ${
                                        panelTab === 'toc'
                                            ? 'border-b-2 border-primary font-medium text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <ListTree className="h-3.5 w-3.5" />
                                    Главы
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPanelTab('bookmarks')}
                                    className={`flex flex-1 items-center justify-center gap-1 px-1.5 py-2 transition-colors ${
                                        panelTab === 'bookmarks'
                                            ? 'border-b-2 border-primary font-medium text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <BookmarkIcon className="h-3.5 w-3.5" />
                                    Закладки
                                    {bookmarks.length > 0 && (
                                        <span className="rounded-full bg-muted px-1.5 text-[10px]">
                                            {bookmarks.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPanelTab('notes')}
                                    className={`flex flex-1 items-center justify-center gap-1 px-1.5 py-2 transition-colors ${
                                        panelTab === 'notes'
                                            ? 'border-b-2 border-primary font-medium text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <NotebookPen className="h-3.5 w-3.5" />
                                    Заметки
                                    {noteCount > 0 && (
                                        <span className="rounded-full bg-muted px-1.5 text-[10px]">
                                            {noteCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {panelTab === 'toc' ? (
                                <div className="flex-1 overflow-auto p-2">
                                    {tocLoading ? (
                                        <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                                            Загрузка оглавления…
                                        </p>
                                    ) : toc.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                                            <ListTree className="h-8 w-8 opacity-40" />
                                            <p>В этом PDF нет оглавления</p>
                                            <p className="text-xs">
                                                Используйте номер страницы или
                                                закладки
                                            </p>
                                        </div>
                                    ) : (
                                        <TocList
                                            entries={toc}
                                            currentPage={currentPage}
                                            onSelect={goToTocEntry}
                                        />
                                    )}
                                </div>
                            ) : panelTab === 'bookmarks' ? (
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
                            ) : (
                                <div className="flex min-h-0 flex-1 flex-col">
                                    <div className="border-b border-border p-2">
                                        <Button
                                            className="w-full justify-start gap-2"
                                            onClick={openNoteComposer}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Добавить заметку
                                            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                                N
                                            </kbd>
                                        </Button>
                                    </div>

                                    <div className="flex-1 overflow-auto p-2">
                                        {notes.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                                                <NotebookPen className="h-8 w-8 opacity-40" />
                                                <p>Пока нет заметок</p>
                                                <p className="text-xs">
                                                    Записывайте мысли, цитаты и
                                                    вопросы — они останутся
                                                    здесь.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {groupedNotes.map(
                                                    ([page, pageNotes]) => (
                                                        <div key={page}>
                                                            <div className="sticky top-0 z-10 -mx-2 mb-1 flex items-center gap-2 bg-card/95 px-3 py-1.5 backdrop-blur">
                                                                <span className="text-[11px] font-semibold text-foreground">
                                                                    Стр. {page}
                                                                </span>
                                                                {pageNotes[0]
                                                                    .section && (
                                                                    <span className="truncate text-[10px] text-muted-foreground">
                                                                        {
                                                                            pageNotes[0]
                                                                                .section
                                                                        }
                                                                    </span>
                                                                )}
                                                                <span className="ml-auto text-[10px] text-muted-foreground">
                                                                    {
                                                                        pageNotes.length
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {pageNotes.map(
                                                                    (note) => (
                                                                        <NoteCard
                                                                            key={
                                                                                note.id
                                                                            }
                                                                            note={
                                                                                note
                                                                            }
                                                                            compact
                                                                            hidePage
                                                                            onOpen={() =>
                                                                                goToNote(
                                                                                    note,
                                                                                )
                                                                            }
                                                                            onEdit={() =>
                                                                                editNote(
                                                                                    note,
                                                                                )
                                                                            }
                                                                            onDelete={() =>
                                                                                void deleteNote(
                                                                                    note,
                                                                                )
                                                                            }
                                                                        />
                                                                    ),
                                                                )}
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-border p-1.5">
                                        <Link
                                            href="/notes"
                                            className="block rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        >
                                            Все заметки →
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </aside>
                    )}
                </div>

                {/* Нижняя панель прогресса */}
                <div
                    className={`border-t border-border bg-card ${
                        compact
                            ? 'px-2 py-0 pb-[env(safe-area-inset-bottom)]'
                            : 'px-3 py-0.5 sm:px-4 sm:py-1'
                    }`}
                >
                    <div
                        className={`flex items-center ${
                            compact
                                ? 'gap-1.5 text-[10px]'
                                : 'gap-1.5 text-[10px] sm:gap-2 sm:text-xs'
                        }`}
                    >
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

            <NoteComposer
                open={noteComposerOpen}
                onOpenChange={(open) => {
                    setNoteComposerOpen(open);
                    if (!open) {
                        setEditingNote(null);
                        setNoteDraft(null);
                    }
                }}
                bookId={book.id}
                bookTitle={book.title}
                page={currentPage}
                section={currentSection}
                suggestedTags={tagSuggestions}
                note={editingNote}
                initialKind={noteDraft?.kind}
                initialBody={noteDraft?.body}
                onSaved={handleNoteSaved}
            />
        </>
    );
}

BooksReader.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
    ],
};