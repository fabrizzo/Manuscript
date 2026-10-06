import { Head } from '@inertiajs/react';
import { dashboard } from '@/routes';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ShoppingCart, Users, CakeIcon } from 'lucide-react';

export default function Dashboard() {
    const stats = [
        { title: 'Всего заказов', value: '12', change: '+2 за сегодня', icon: ShoppingCart },
        { title: 'Тортов в меню', value: '24', change: '+1 (Новый)', icon: CakeIcon },
        { title: 'Новых клиентов', value: '3', change: '+3 за сегодня', icon: Users },
    ];

    return (
        <>
            <Head title="Панель управления" />
            <div className="space-y-8 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Добро пожаловать!</h1>
                    <p className="text-muted-foreground">Обзор состояния вашего магазина тортов.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stats.map((stat, index) => (
                        <Card key={index}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                <stat.icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <p className="text-xs text-muted-foreground">{stat.change}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Панель',
            href: dashboard(),
        },
    ],
};