import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';

type AppLogoProps = {
    className?: string;
    showWordmark?: boolean;
    iconClassName?: string;
};

export default function AppLogo({
    className,
    showWordmark = true,
    iconClassName,
}: AppLogoProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-md">
                <AppLogoIcon className={cn('size-5', iconClassName)} />
            </div>
            {showWordmark && (
                <span className="truncate text-sm leading-tight font-semibold">
                    Stumped
                </span>
            )}
        </div>
    );
}
