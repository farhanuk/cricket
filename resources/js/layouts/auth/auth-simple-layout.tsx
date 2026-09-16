import { Link } from '@inertiajs/react';
import AppLogo from '@/components/app-logo';
import { Card, CardContent } from '@/components/ui/card';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const showHeading =
        (title !== undefined && title !== '') ||
        (description !== undefined && description !== '');

    return (
        <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-8">
                <Link
                    href={home()}
                    className="flex justify-center font-medium"
                >
                    <AppLogo className="flex-col gap-3 sm:flex-row" />
                </Link>

                <Card className="border-border/80 shadow-sm">
                    <CardContent className="space-y-6 pt-8 pb-8">
                        {showHeading && (
                            <div className="space-y-2 text-center">
                                {title ? (
                                    <h1 className="text-xl font-semibold tracking-tight">
                                        {title}
                                    </h1>
                                ) : null}
                                {description ? (
                                    <p className="text-muted-foreground text-sm text-balance">
                                        {description}
                                    </p>
                                ) : null}
                            </div>
                        )}
                        {children}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
