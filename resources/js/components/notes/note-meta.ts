import {
    CircleHelp,
    Lightbulb,
    ListTodo,
    Quote,
    type LucideIcon,
} from 'lucide-react';
import type { NoteKind } from '@/types/note';

export type NoteKindMeta = {
    value: NoteKind;
    label: string;
    placeholder: string;
    icon: LucideIcon;
    iconClass: string;
    badge: string;
    chipActive: string;
};

export const NOTE_KINDS: NoteKindMeta[] = [
    {
        value: 'idea',
        label: 'Мысль',
        placeholder: 'Что показалось важным? Сформулируйте своими словами…',
        icon: Lightbulb,
        iconClass: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        chipActive:
            'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300',
    },
    {
        value: 'quote',
        label: 'Цитата',
        placeholder: 'Вставьте или перепишите цитату из книги…',
        icon: Quote,
        iconClass: 'text-sky-600 dark:text-sky-400',
        badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        chipActive:
            'bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/40 dark:text-sky-300',
    },
    {
        value: 'question',
        label: 'Вопрос',
        placeholder: 'Что осталось непонятным? Что хочется выяснить?',
        icon: CircleHelp,
        iconClass: 'text-violet-600 dark:text-violet-400',
        badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
        chipActive:
            'bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/40 dark:text-violet-300',
    },
    {
        value: 'task',
        label: 'Попробовать',
        placeholder: 'Что хочется проверить на практике? Опишите эксперимент…',
        icon: ListTodo,
        iconClass: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        chipActive:
            'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40 dark:text-emerald-300',
    },
];

export const noteKindMeta = (kind: NoteKind): NoteKindMeta =>
    NOTE_KINDS.find((item) => item.value === kind) ?? NOTE_KINDS[0];
