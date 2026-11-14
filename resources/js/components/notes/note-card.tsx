import { Pencil, Trash2 } from 'lucide-react';
import { noteKindMeta } from '@/components/notes/note-meta';
import { Button } from '@/components/ui/button';
import type { Note } from '@/types/note';

type Props = {
    note: Note;
    onOpen: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showBook?: boolean;
    hidePage?: boolean;
    compact?: boolean;
};

const formatDate = (iso: string, withYear: boolean) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
    };
    if (withYear) options.year = 'numeric';
    return date.toLocaleDateString('ru-RU', options);
};

export function NoteCard({
    note,
    onOpen,
    onEdit,
    onDelete,
    showBook = false,
    hidePage = false,
    compact = false,
}: Props) {
    const meta = noteKindMeta(note.kind);
    const Icon = meta.icon;

    return (
        <div
            className={`group relative rounded-lg border border-border bg-card transition-colors hover:border-primary/30 ${
                compact ? 'p-2.5' : 'p-3'
            }`}
        >
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full flex-col gap-2 pr-16 text-left"
            >
                <div className="flex flex-wrap items-center gap-1.5">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
                    >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                    </span>

                    {showBook && note.book ? (
                        <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                            {note.book.title}
                        </span>
                    ) : !hidePage ? (
                        <span className="text-[11px] font-medium text-foreground">
                            Стр. {note.page}
                        </span>
                    ) : null}

                    <span className="text-[10px] text-muted-foreground">
                        {formatDate(note.created_at, !compact)}
                    </span>
                </div>

                <p
                    className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground ${
                        compact ? 'line-clamp-4' : 'line-clamp-6'
                    }`}
                >
                    {note.body}
                </p>

                {(note.tags.length > 0 || note.section) && (
                    <div className="flex flex-wrap items-center gap-1">
                        {note.section && (
                            <span className="line-clamp-1 max-w-full text-[10px] text-muted-foreground">
                                {note.section}
                            </span>
                        )}
                        {note.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </button>

            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                {onEdit && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onEdit}
                        aria-label="Редактировать заметку"
                        title="Редактировать"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                )}
                {onDelete && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onDelete}
                        aria-label="Удалить заметку"
                        title="Удалить"
                    >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                )}
            </div>
        </div>
    );
}
