import { Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { create, index } from '@/routes/fixtures';

type Season = {
    id: number;
    name: string;
};

type Fixture = {
    id: number;
    opponent: string;
    played_at: string | null;
    venue: string | null;
    overs: number;
    status: string;
    season: Season;
};

type PageProps = {
    fixtures: Fixture[];
};

function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    return new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function FixturesIndex({ fixtures }: PageProps) {
    return (
        <>
            <Head title="Fixtures" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                    <Heading title="Fixtures" />
                    <Button asChild>
                        <Link href={create()}>New fixture</Link>
                    </Button>
                </div>

                {fixtures.length === 0 ? (
                    <div className="border-sidebar-border/70 dark:border-sidebar-border flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-16 text-center">
                        <p className="text-lg font-medium">No fixtures yet</p>
                        <p className="text-muted-foreground max-w-sm text-sm">
                            Create your first fixture to start scheduling matches
                            for the season.
                        </p>
                        <Button asChild className="mt-2">
                            <Link href={create()}>New fixture</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Opponent</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Venue</TableHead>
                                    <TableHead>Overs</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fixtures.map((fixture) => (
                                    <TableRow key={fixture.id}>
                                        <TableCell>{fixture.opponent}</TableCell>
                                        <TableCell>
                                            {formatDate(fixture.played_at)}
                                        </TableCell>
                                        <TableCell>
                                            {fixture.venue ?? '—'}
                                        </TableCell>
                                        <TableCell>{fixture.overs}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    fixture.status ===
                                                    'scheduled'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                            >
                                                {formatStatus(fixture.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/fixtures/${fixture.id}/selection`}
                                                    >
                                                        Select squad
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/fixtures/${fixture.id}/pairs`}
                                                    >
                                                        Pairs
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            `/fixtures/${fixture.id}/score`,
                                                        )
                                                    }
                                                >
                                                    Score
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </>
    );
}

FixturesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: index(),
        },
    ],
};
