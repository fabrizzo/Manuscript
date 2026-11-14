import { useEffect, useRef, useState } from 'react';
import { Hash, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { NOTE_KINDS, noteKindMeta } from '@/components/notes/note-meta';
import type { Note, NoteKind } from '@/types/note';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookId: number;
    bookTitle: string;
    page: number;
    section: string | null;
    suggestedTags: string[];
    note?: Note | null;
    initialKind?: NoteKind;
    initialBody?: string;
    onSaved: (note: Note) => void;
};

const normalizeTag = (value: string) =>
    value
        .trim()
        .replace(/^#+/, '')
        .replace(/\s+/g, ' ')
        .slice(0, 40);

export function NoteComposer({
    open,
    onOpenChange,
    bookId,
    bookTitle,
    page,
    section,
    suggestedTags,
    note,
    initialKind,
    initialBody,
    onSaved,
}: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [kind, setKind] = useState<NoteKind>('idea');
    const [body, setBody] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const effectivePage = note?.page ?? page;
    const effectiveSection = note?.section ?? section;
    const meta = noteKindMeta(kind);

    useEffect(() => {
        if (!open) return;

        setKind(note?.kind ?? initialKind ?? 'idea');
        setBody(note?.body ?? initialBody ?? '');
        setTags(note?.tags ?? []);
        setTagInput('');
        setError(null);
        setSaving(false);

        // Даём диалогу смонтироваться и ставим курсор в текст.
        const timer = window.setTimeout(() => {
            textareaRef.current?.focus();
        }, 60);

        return () => window.clearTimeout(timer);
    }, [open, note, initialKind, initialBody]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
    }, [body, open]);

    const addTag = (raw: string) => {
        const value = normalizeTag(raw);
        if (!value) return;
        setTags((prev) => {
            if (prev.includes(value) || prev.length >= 8) return prev;
            return [...prev, value];
        });
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setTags((prev) => prev.filter((item) => item !== tag));
    };

    const submit = async () => {
        const text = body.trim();
        if (!text || saving) return;

        const pendingTag = normalizeTag(tagInput);
        const finalTags =
            pendingTag && !tags.includes(pendingTag) && tags.length < 8
                ? [...tags, pendingTag]
                : tags;

        setSaving(true);
        setError(null);

        const token =
            document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content ?? '';

        const url = note
            ? `/books/${bookId}/notes/${note.id}`
            : `/books/${bookId}/notes`;

        try {
            const response = await fetch(url, {
                method: note ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    page: effectivePage,
                    kind,
                    body: text,
                    tags: finalTags,
                    section: effectiveSection,
                }),
                credentials: 'same-origin',
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const message =
                    data?.errors && typeof data.errors === 'object'
                        ? (Object.values(data.errors).flat()[0] as string)
                        : (data?.message as string) ||
                          'Не удалось сохранить заметку';
                throw new Error(message);
            }

            onSaved(data as Note);
            toast.success(note ? 'Заметка обновлена' : 'Заметка сохранена');
            onOpenChange(false);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Не удалось сохранить заметку',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] sm:max-w-xl"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    textareaRef.current?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {note ? 'Редактировать заметку' : 'Новая заметка'}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-foreground">
                            {bookTitle}
                        </span>
                        <span> · стр. {effectivePage}</span>
                        {effectiveSection && (
                            <span className="line-clamp-1 max-w-full">
                                · {effectiveSection}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit();
                    }}
                >
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {NOTE_KINDS.map((item) => {
                            const Icon = item.icon;
                            const active = kind === item.value;

                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setKind(item.value)}
                                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                                        active
                                            ? item.chipActive
                                            : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <Icon
                                        className={`h-3.5 w-3.5 ${active ? '' : item.iconClass}`}
                                    />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                (event.ctrlKey || event.metaKey) &&
                                event.key === 'Enter'
                            ) {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                        rows={4}
                        placeholder={meta.placeholder}
                        className="min-h-[120px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Hash className="h-3.5 w-3.5" />
                            Теги
                            <span className="font-normal text-muted-foreground/70">
                                необязательно
                            </span>
                        </div>

                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => removeTag(tag)}
                                            className="rounded-full p-0.5 hover:bg-primary/20"
                                            aria-label={`Убрать тег ${tag}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <input
                                value={tagInput}
                                onChange={(event) =>
                                    setTagInput(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' ||
                                        event.key === ','
                                    ) {
                                        event.preventDefault();
                                        addTag(tagInput);
                                    } else if (
                                        event.key === 'Backspace' &&
                                        tagInput === '' &&
                                        tags.length > 0
                                    ) {
                                        removeTag(tags[tags.length - 1]);
                                    }
                                }}
                                onBlur={() => {
                                    if (tagInput.trim()) addTag(tagInput);
                                }}
                                placeholder="Добавить тег…"
                                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                disabled={!tagInput.trim() || tags.length >= 8}
                                onClick={() => addTag(tagInput)}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {suggestedTags.filter(
                            (tag) => !tags.includes(tag),
                        ).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {suggestedTags
                                    .filter((tag) => !tags.includes(tag))
                                    .slice(0, 8)
                                    .map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => addTag(tag)}
                                            className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:items-center">
                        <span className="mr-auto hidden text-[11px] text-muted-foreground sm:block">
                            Ctrl + Enter — сохранить
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={!body.trim() || saving}
                        >
                            {saving && (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            )}
                            {note ? 'Сохранить' : 'Добавить заметку'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
