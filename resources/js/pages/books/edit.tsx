import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ImageIcon,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import InputError from '@/components/input-error';
import { Wand2 } from 'lucide-react';
import { transliterateToCyrillic } from '@/lib/transliterate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { BookEdit } from '@/types/book';
import { update as updateRoute } from '@/routes/books';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
    book: BookEdit;
    categories: Array<{ id: number; name: string }>;
};

export default function BooksEdit({ book, categories }: Props) {
    const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
    const [coverLoading, setCoverLoading] = useState(false);
    const [title, setTitle] = useState(book.title);
    const [coverPage, setCoverPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(
        book.total_pages ?? 0,
    );
    const [categoryId, setCategoryId] = useState<string>(
        book.category_id ? String(book.category_id) : '',
    );

    const pdfDocRef = useRef<any>(null);
    const coverCanvasRef = useRef<HTMLCanvasElement>(null);

    // Загружаем PDF один раз, чтобы можно было менять страницу обложки
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const pdf = await pdfjsLib.getDocument({
                    url: book.file_url,
                    wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`,
                }).promise;
                if (cancelled) return;
                pdfDocRef.current = pdf;
                setTotalPages(pdf.numPages);
            } catch (e) {
                console.error('PDF load error:', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [book.file_url]);

    const renderCoverPage = async (pageNum: number) => {
        const pdf = pdfDocRef.current;
        if (!pdf) return;

        setCoverLoading(true);
        try {
            const page = await pdf.getPage(pageNum);
            const baseViewport = page.getViewport({ scale: 1 });
            const targetWidth = 400;
            const scale = targetWidth / baseViewport.width;
            const viewport = page.getViewport({ scale });

            const canvas = coverCanvasRef.current;
            if (!canvas) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D context недоступен');

            await page.render({ canvasContext: ctx, viewport }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setCoverDataUrl(dataUrl);
        } catch (e) {
            console.error('Cover render error:', e);
        } finally {
            setCoverLoading(false);
        }
    };

    const goToCoverPage = async (n: number) => {
        const clamped = Math.min(Math.max(1, n), totalPages || 1);
        setCoverPage(clamped);
        await renderCoverPage(clamped);
    };

    const resetCover = () => {
        setCoverDataUrl(null);
        setCoverPage(1);
    };

    // Что показывать в превью: новую (если генерили) или текущую из БД
    const previewUrl = coverDataUrl ?? book.cover_url;
    const coverChanged = coverDataUrl !== null;

    return (
        <>
            <Head title={`Редактировать: ${book.title}`} />

            <div className="space-y-8 p-4 md:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="-ml-2 mb-2"
                    >
                        <Link href={`/books/${book.id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К книге
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Редактировать книгу
                    </h1>
                    <p className="text-muted-foreground">
                        Измените метаданные или выберите другую обложку.
                    </p>
                </div>

                <Form
                    action={updateRoute.url({ book: book.id })}
                    method="patch"
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            {/* Обложка */}
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between">
                                    <Label>Обложка</Label>
                                    {coverChanged && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={resetCover}
                                            disabled={coverLoading}
                                        >
                                            <RotateCcw className="mr-2 h-3 w-3" />
                                            Сбросить изменения
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                    <div className="flex h-[200px] w-[145px] shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                                        {coverLoading ? (
                                            <Spinner className="h-6 w-6" />
                                        ) : previewUrl ? (
                                            <img
                                                src={previewUrl}
                                                alt="Превью обложки"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <p className="text-sm text-muted-foreground">
                                            Перелистните страницу, чтобы
                                            выбрать новую обложку. По умолчанию
                                            используется текущая.
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() =>
                                                    goToCoverPage(coverPage - 1)
                                                }
                                                disabled={
                                                    coverPage <= 1 ||
                                                    coverLoading
                                                }
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>

                                            <Input
                                                type="number"
                                                min={1}
                                                max={totalPages || 1}
                                                value={coverPage}
                                                onChange={(e) => {
                                                    const n = parseInt(
                                                        e.target.value,
                                                        10,
                                                    );
                                                    if (!isNaN(n))
                                                        goToCoverPage(n);
                                                }}
                                                className="h-9 w-20 text-center"
                                            />

                                            <span className="text-sm text-muted-foreground">
                                                / {totalPages || '…'}
                                            </span>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() =>
                                                    goToCoverPage(coverPage + 1)
                                                }
                                                disabled={
                                                    coverPage >= totalPages ||
                                                    coverLoading
                                                }
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Категория */}
                            <div className="grid gap-2">
                                <Label htmlFor="category_id">Категория</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger id="category_id">
                                        <SelectValue placeholder="Выберите категорию" />
                                    </SelectTrigger>
                                    <SelectContent
                                        position="popper"
                                        className="max-h-[320px]"
                                    >
                                        {categories.map((cat) => (
                                            <SelectItem
                                                key={cat.id}
                                                value={String(cat.id)}
                                            >
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.category_id} />
                            </div>

                            {/* Название */}
                            <div className="grid gap-2">
                                <Label htmlFor="title">Название</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="title"
                                        name="title"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setTitle(transliterateToCyrillic(title))}
                                        title="Транслитерировать в кириллицу"
                                    >
                                        <Wand2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <InputError message={errors.title} />
                            </div>

                            {/* Автор */}
                            <div className="grid gap-2">
                                <Label htmlFor="author">Автор</Label>
                                <Input
                                    id="author"
                                    name="author"
                                    defaultValue={book.author ?? ''}
                                    placeholder="Необязательно"
                                />
                                <InputError message={errors.author} />
                            </div>

                            {/* Описание */}
                            <div className="grid gap-2">
                                <Label htmlFor="description">Описание</Label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={4}
                                    defaultValue={book.description ?? ''}
                                    placeholder="Заметки о книге, оглавление, что важно..."
                                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <InputError message={errors.description} />
                            </div>

                            {/* Скрытые поля */}
                            <input
                                type="hidden"
                                name="cover"
                                value={coverDataUrl ?? ''}
                            />
                            <input
                                type="hidden"
                                name="category_id"
                                value={categoryId}
                            />
                            <canvas
                                ref={coverCanvasRef}
                                className="hidden"
                            />

                            <div className="flex gap-3">
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Сохранить
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/books">
                                        Отмена
                                    </Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

BooksEdit.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
        { title: 'Редактировать', href: '#' },
    ],
};