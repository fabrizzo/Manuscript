import { Link, usePage } from '@inertiajs/react';
import { BookOpen } from 'lucide-react';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

type RecentBook = {
    id: number;
    title: string;
    current_page: number;
};

export function RecentBooks() {
    const { recentBooks } = usePage<{ recentBooks: RecentBook[] }>().props;

    if (!recentBooks || recentBooks.length === 0) {
        return null;
    }

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Недавние</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {recentBooks.map((book) => (
                        <SidebarMenuItem key={book.id}>
                            <SidebarMenuButton asChild tooltip={book.title}>
                                <Link href={`/books/${book.id}`}>
                                    <BookOpen className="h-4 w-4 shrink-0" />
                                    <div className="flex min-w-0 flex-1 flex-col gap-0">
                                        <span className="w-full truncate text-xs leading-tight">
                                            {book.title}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            стр. {book.current_page}
                                        </span>
                                    </div>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}