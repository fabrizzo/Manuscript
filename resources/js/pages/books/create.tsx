import { Form, Head, Link } from '@inertiajs/react';
import { Wand2 } from 'lucide-react';
import { transliterateToCyrillic } from '@/lib/transliterate';
import { ArrowLeft, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import InputError from '@/components/input-error';
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
import { store } from '@/routes/books';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
    categories: Array<{ id: number; name: string }>;
};

/**
 * Приводит имя файла к читаемому виду:
 * "Asinhronnoe_programmirovanie_v_C#_5.0_(2013).pdf"
 * → "Asinhronnoe programmirovanie v C# 5.0 (2013)"
 */
function cleanFilename(filename: string): string {
    return filename
        .replace(/\.pdf$/i, '')      // убираем .pdf
        .replace(/[_]+/g, ' ')        // подчёркивания → пробелы
        .replace(/\s+/g, ' ')         // сжимаем двойные пробелы
        .trim();
}

export default function BooksCreate({ categories }: Props) {
    const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
    const [coverLoading, setCoverLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [coverPage, setCoverPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [categoryId, setCategoryId] = useState<string>('');

    const pdfDocRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverCanvasRef = useRef<HTMLCanvasElement>(null);

    /**
     * Рендерит указанную страницу PDF в canvas и возвращает JPEG dataURL.
     */
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
            setCoverDataUrl(null);
        } finally {
            setCoverLoading(false);
        }
    };

    /**
     * При выборе PDF — загружаем документ и сразу рендерим страницу 1.
     */
    const onFileChange = async (file: File | undefined) => {
        if (!file) {
            pdfDocRef.current = null;
            setCoverDataUrl(null);
            setTotalPages(0);
            setCoverPage(1);
            setTitle('');           // ← очищаем title
            return;
        }

        // Подставляем имя файла в поле "Название"
        setTitle(cleanFilename(file.name));

        setCoverLoading(true);
        setCoverDataUrl(null);
        setTotalPages(0);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
                wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`,
            }).promise;
            pdfDocRef.current = pdf;
            setTotalPages(pdf.numPages);
            setCoverPage(1);
            await renderCoverPage(1);
        } catch (e) {
            console.error('PDF load error:', e);
            pdfDocRef.current = null;
            setCoverLoading(false);
        }
    };

    const goToCoverPage = async (n: number) => {
        const clamped = Math.min(Math.max(1, n), totalPages || 1);
        setCoverPage(clamped);
        await renderCoverPage(clamped);
    };

    return (
        <>
            <Head title="Загрузить книгу" />

            <div className="space-y-8 p-4 md:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="-ml-2 mb-2"
                    >
                        <Link href="/books">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К списку книг
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Загрузить книгу
                    </h1>
                    <p className="text-muted-foreground">
                        Выберите PDF-файл и заполните информацию о книге.
                    </p>
                </div>

                <Form
                    {...store.form()}
                    encType="multipart/form-data"
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="file">PDF-файл</Label>
                                <Input
                                    ref={fileInputRef}
                                    id="file"
                                    name="file"
                                    type="file"
                                    accept="application/pdf"
                                    required
                                    onChange={(e) =>
                                        onFileChange(e.target.files?.[0])
                                    }
                                />
                                <InputError message={errors.file} />
                            </div>

                            {/* Обложка + выбор страницы */}
                            {(coverLoading || coverDataUrl) && (
                                <div className="grid gap-3">
                                    <Label>Обложка</Label>
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                        {/* Превью */}
                                        <div className="flex h-[200px] w-[145px] shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                                            {coverLoading ? (
                                                <Spinner className="h-6 w-6" />
                                            ) : coverDataUrl ? (
                                                <img
                                                    src={coverDataUrl}
                                                    alt="Превью обложки"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                            )}
                                        </div>

                                        {/* Управление страницей */}
                                        <div className="flex flex-col gap-3">
                                            <p className="text-sm text-muted-foreground">
                                                Выберите страницу, которая
                                                станет обложкой книги.
                                            </p>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() =>
                                                        goToCoverPage(
                                                            coverPage - 1,
                                                        )
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
                                                        goToCoverPage(
                                                            coverPage + 1,
                                                        )
                                                    }
                                                    disabled={
                                                        coverPage >=
                                                            totalPages ||
                                                        coverLoading
                                                    }
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {coverPage !== 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        goToCoverPage(1)
                                                    }
                                                    disabled={coverLoading}
                                                    className="-ml-3 self-start"
                                                >
                                                    Сбросить на 1-ю
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="category_id">Категория</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger id="category_id">
                                        <SelectValue placeholder="Выберите категорию" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="max-h-[320px]">
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={String(cat.id)}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.category_id} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="title">Название</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="title"
                                        name="title"
                                        required
                                        placeholder="Например: Laravel. Полный курс"
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

                            <div className="grid gap-2">
                                <Label htmlFor="author">Автор</Label>
                                <Input
                                    id="author"
                                    name="author"
                                    placeholder="Необязательно"
                                />
                                <InputError message={errors.author} />
                            </div>

                            {/* Скрытое поле с актуальной обложкой */}
                            <input
                                type="hidden"
                                name="cover"
                                value={coverDataUrl ?? ''}
                            />

                            {/* Скрытое поле с категорией (shadcn Select не отправляет сам) */}
                            <input
                                type="hidden"
                                name="category_id"
                                value={categoryId}
                            />

                            {/* Скрытый canvas для рендера — не видно пользователю */}
                            <canvas ref={coverCanvasRef} className="hidden" />

                            <div className="flex gap-3">
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Загрузить
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/books">Отмена</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

BooksCreate.layout = {
    breadcrumbs: [
        { title: 'Мои книги', href: '/books' },
        { title: 'Загрузить книгу', href: '/books/create' },
    ],
};