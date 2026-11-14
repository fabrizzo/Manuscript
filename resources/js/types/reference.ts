export type SnippetKind = 'command' | 'code' | 'config' | 'sql';

export type BookSnippet = {
    id: number;
    page: number;
    kind: SnippetKind;
    language: string | null;
    text: string;
    section: string | null;
    stack?: string | null;
    book?: {
        id: number;
        title: string;
        author: string | null;
    } | null;
};

export type SnippetDraft = {
    page: number;
    kind: SnippetKind;
    language: string | null;
    text: string;
    section: string | null;
};

export type TextStatus = 'ready' | 'empty' | 'failed' | 'pending';
