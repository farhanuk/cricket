import { Link } from '@inertiajs/react';
import { BarChart3, Calendar, LayoutGrid, Users } from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as fixturesIndex } from '@/routes/fixtures';
import { index as playersIndex } from '@/routes/players';

const navItems = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        startsWith: false,
        alsoHome: true,
    },
    {
        title: 'Players',
        href: playersIndex(),
        icon: Users,
        startsWith: true,
        alsoHome: false,
    },
    {
        title: 'Fixtures',
        href: fixturesIndex(),
        icon: Calendar,
        startsWith: true,
        alsoHome: false,
    },
    {
        title: 'Stats',
        href: '/stats',
        icon: BarChart3,
        startsWith: true,
        alsoHome: false,
    },
] as const;

export function MobileBottomNav() {
    const { currentUrl, isCurrentUrl } = useCurrentUrl();

    return (
        <nav
            className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur md:hidden"
            aria-label="Main navigation"
        >
            <div className="mx-auto grid max-w-lg grid-cols-4">
                {navItems.map((item) => {
                    const active =
                        isCurrentUrl(item.href, currentUrl, item.startsWith) ||
                        (item.alsoHome && currentUrl === '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.title}
                            href={item.href}
                            prefetch
                            className={cn(
                                'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors sm:text-xs',
                                active
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Icon
                                className={cn(
                                    'size-5',
                                    active && 'stroke-[2.5]',
                                )}
                                aria-hidden
                            />
                            <span className="truncate">{item.title}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
