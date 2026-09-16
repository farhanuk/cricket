import { Link } from '@inertiajs/react';
import { BarChart3, Calendar, LayoutGrid } from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as fixturesIndex } from '@/routes/fixtures';

const navItems = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        startsWith: false,
        alsoHome: true,
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
            className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            aria-label="Main navigation"
        >
            <div className="mx-auto grid max-w-lg grid-cols-3">
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
                                'flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors',
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
                            <span>{item.title}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
