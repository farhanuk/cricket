import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

type MatchHomeButtonProps = {
    fixtureId: number;
};

export default function MatchHomeButton({ fixtureId }: MatchHomeButtonProps) {
    return (
        <Link
            href={`/fixtures/${fixtureId}/match`}
            aria-label="Back to match"
            className="bg-background/95 text-foreground hover:bg-muted border-border fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium shadow-md backdrop-blur transition-colors"
        >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Match
        </Link>
    );
}
