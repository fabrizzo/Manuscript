export type NoteKind = 'idea' | 'quote' | 'question' | 'task';

export type Note = {
    id: number;
    page: number;
    kind: NoteKind;
    body: string;
    tags: string[];
    section: string | null;
    created_at: string;
    updated_at: string;
    book?: {
        id: number;
        title: string;
        author: string | null;
        cover_url: string | null;
    };
};
