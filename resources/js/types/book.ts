export type Category = {
    id: number;
    name: string;
    slug: string;
    books_count?: number;
};

export type BookListItem = {
    id: number;
    title: string;
    author: string | null;
    file_path: string;
    cover_url: string | null;   // ← добавили
    description: string | null;
    total_pages: number | null;
    current_page: number;
    percent_read: number;
    created_at: string;
    category: Category | null;
};

export type BookReader = {
    id: number;
    title: string;
    author: string | null;
    description: string | null;   // ← добавили
    file_path: string;
    file_url: string;
    total_pages: number | null;
    current_page: number;
};

export type Bookmark = {
    id: number;
    page: number;
    label: string | null;
};

export type ContinueReadingBook = {
    id: number;
    title: string;
    author: string | null;
    cover_url: string | null;
    total_pages: number | null;
    current_page: number;
    percent_read: number;
    last_read_at: string | null;
    category: { id: number; name: string } | null;
};