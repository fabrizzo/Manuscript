import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { home } from '@/routes';

export default function AuthCardLayout({
    children,
    title,
    description,
}: PropsWithChildren<{
    name?: string;
    title?: string;
    description?: string;
}>) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-muted p-6 md:p-10">
            {/* Декоративный фон — мягкие круги */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-900/20" />
                <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-900/20" />
            </div>

            <div className="relative flex w-full max-w-md flex-col gap-8">
                {/* Логотип + бренд */}
                <Link
                    href={home()}
                    className="flex flex-col items-center gap-3 text-center"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/5 p-3 backdrop-blur-sm transition-colors hover:bg-foreground/10">
                        <AppLogoIcon className="size-8 text-foreground" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-semibold tracking-tight text-foreground">
                            Манускрипт
                        </span>
                        <span className="text-sm text-muted-foreground">
                            Древние свитки современного кода
                        </span>
                    </div>
                </Link>

                {/* Карточка с формой */}
                <Card className="rounded-2xl border-border/50 shadow-lg backdrop-blur-sm">
                    <CardHeader className="px-8 pt-8 pb-0 text-center">
                        {title && (
                            <CardTitle className="text-xl">{title}</CardTitle>
                        )}
                        {description && (
                            <CardDescription>{description}</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="px-8 py-8">{children}</CardContent>
                </Card>
            </div>
        </div>
    );
}