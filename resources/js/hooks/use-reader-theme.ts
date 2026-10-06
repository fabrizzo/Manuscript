import { useEffect, useState } from 'react';

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'night';

export const readerThemes: Record<
    ReaderTheme,
    { name: string; wrapper: string; canvasBorder: string; preview: string }
> = {
    light: {
        name: 'Светлая',
        wrapper: 'bg-stone-200',
        canvasBorder: 'border-stone-300',
        preview: '#e7e5e4',
    },
    sepia: {
        name: 'Сепия',
        wrapper: 'bg-[#f0e6d2]',
        canvasBorder: 'border-[#d4c5a0]',
        preview: '#f0e6d2',
    },
    dark: {
        name: 'Тёмная',
        wrapper: 'bg-stone-900',
        canvasBorder: 'border-stone-700',
        preview: '#1c1917',
    },
    night: {
        name: 'Ночная',
        wrapper: 'bg-black',
        canvasBorder: 'border-stone-800',
        preview: '#000000',
    },
};

const STORAGE_KEY = 'manuscript-reader-theme';

export function useReaderTheme() {
    const [theme, setTheme] = useState<ReaderTheme>(() => {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem(STORAGE_KEY) as ReaderTheme | null;
        return saved && saved in readerThemes ? saved : 'light';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    return { theme, setTheme };
}