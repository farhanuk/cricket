import { Link } from '@inertiajs/react';
import { House } from 'lucide-react';

type MatchHomeButtonProps = {
    fixtureId: number;
};

export default function MatchHomeButton({ fixtureId }: MatchHomeButtonProps) {
    return (
        <Link
            href={`/fixtures/${fixtureId}/match`}
            aria-label="Back to match home"
            className="bg-primary text-primary-foreground hover:bg-primary/90 fixed top-4 right-4 z-50 flex size-11 items-center justify-center rounded-full shadow-md transition-colors"
        >
            <House className="size-5" />
        </Link>
    );
}
