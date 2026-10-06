import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
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

            <div className="relative w-full max-w-sm">
                <div className="flex flex-col gap-8">
                    {/* Логотип + бренд */}
                    <div className="flex flex-col items-center gap-4">
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

                        <div className="mt-2 space-y-2 text-center">
                            <h1 className="text-xl font-medium">{title}</h1>
                            {description && (
                                <p className="text-center text-sm text-muted-foreground">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}