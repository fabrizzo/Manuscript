import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login, register } from '@/routes';
import { CakeIcon } from 'lucide-react';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Кондитерская на заказ" />

            {/* Навигация */}
            <header className="w-full bg-white/70 py-4 backdrop-blur-lg dark:bg-neutral-900/70">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="text-xl font-bold text-primary">
                        PerePie
                    </Link>
                    <nav className="flex items-center gap-4">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="inline-block rounded-sm border border-border px-5 py-1.5 text-sm hover:bg-muted"
                            >
                                Панель
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="inline-block rounded-sm border border-border px-5 py-1.5 text-sm hover:bg-muted"
                                >
                                    Войти
                                </Link>
                                <Link
                                    href={register()}
                                    className="inline-block rounded-sm bg-primary px-5 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
                                >
                                    Регистрация
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* Главный экран (Hero) - ИСПРАВЛЕНО: Картинка больше не перекрывает контент */}
            <div className="relative overflow-hidden bg-white dark:bg-neutral-950">
                {/* Декоративный градиент на фоне */}
                <div className="absolute -inset-y-10 -inset-x-20 -z-10 scale-[2] rounded-full bg-gradient-to-tr from-rose-100 to-orange-100 opacity-30 dark:from-rose-900 dark:to-orange-900" />

                {/* Контент страницы */}
                <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:flex lg:items-center lg:justify-between">
                    
                    {/* Левая часть: Текст */}
                    <div className="max-w-xl text-center lg:text-left">
                        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl lg:text-6xl">
                            Сладкие шедевры
                            <br />
                            <span className="text-primary">на ваш праздник</span>
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-neutral-400">
                            Создаем торты, которые запомнятся. Натуральные ингредиенты, уникальный дизайн и доставка по городу.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
                            {!auth.user && (
                                <Link
                                    href={register()}
                                    className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    Создать торт мечты
                                </Link>
                            )}
                            <a
                                href="#catalog"
                                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                            >
                                Смотреть каталог <span aria-hidden="true">&rarr;</span>
                            </a>
                        </div>
                    </div>

                    {/* Правая часть: Картинка */}
                    <div className="mt-10 flex justify-center lg:mt-0 lg:flex-shrink-0 lg:justify-end">
                        <div className="relative w-[300px] overflow-hidden rounded-xl shadow-lg sm:w-[400px]">
                            <img
                                src="/images/hero.jpg"
                                alt="Вкусный торт"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                </div>
            </div>

            {/* Блок с преимуществами */}
            <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:py-32">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
                        Почему выбирают нас?
                    </h2>
                    <p className="mt-2 text-lg leading-8 text-neutral-600 dark:text-neutral-400">
                        Мы вкладываем душу в каждый десерт.
                    </p>
                </div>
                <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Блок 1: Дизайн */}
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CakeIcon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Уникальный дизайн</h3>
                        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Любые формы и цвета под ваш запрос.</p>
                    </div>

                    {/* Блок 2: Ингредиенты */}
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h6l-3.6 3.6M17.25 17.25L12 21l-1.5-1.5M12 6V4.5a2.25 2.25 0 114.5 0V6" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Натуральные продукты</h3>
                        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Только бельгийский шоколад и свежие ягоды.</p>
                    </div>

                    {/* Блок 3: Доставка */}
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a3 3 0 11-6 0 3 3 0 016 0zm12.75 0a3 3 0 01-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Доставка</h3>
                        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Аккуратно привезем в термосумке.</p>
                    </div>
                </div>
            </div>
        </>
    );
}