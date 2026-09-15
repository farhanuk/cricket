import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { create, index } from '@/routes/fixtures';

type Fixture = {
    id: number;
    opponent: string;
    played_at: string | null;
};

type PageProps = {
    fixtures: Fixture[];
};

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return today;
}

function isPastFixture(playedAt: string | null): boolean {
    if (!playedAt) {
        return false;
    }

    const date = new Date(playedAt);
    date.setHours(0, 0, 0, 0);

    return date < startOfToday();
}

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

function FixtureStatusBadge({ playedAt }: { playedAt: string | null }) {
    const past = isPastFixture(playedAt);

    if (past) {
        return <Badge variant="secondary">Played</Badge>;
    }

    return (
        <Badge className="border-green-500/30 bg-green-600 text-white hover:bg-green-600/90">
            Upcoming
        </Badge>
    );
}

function FixtureDate({
    playedAt,
    className,
}: {
    playedAt: string | null;
    className?: string;
}) {
    return (
        <span
            className={cn(
                isPastFixture(playedAt)
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                className,
            )}
        >
            {formatDate(playedAt)}
        </span>
    );
}

export default function FixturesIndex({ fixtures }: PageProps) {
    const [deleteTarget, setDeleteTarget] = useState<Fixture | null>(null);
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = () => {
        if (deleteTarget === null) {
            return;
        }

        setDeleting(true);

        router.delete(`/fixtures/${deleteTarget.id}`, {
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    return (
        <>
            <Head title="Fixtures" />

            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {deleteTarget
                                ? `Delete match vs ${deleteTarget.opponent}?`
                                : 'Delete match?'}
                        </DialogTitle>
                        <DialogDescription>
                            This deletes the match and its scorecard
                            (selections, pairs, and all recorded balls). Your
                            players are not affected.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={deleting}
                            onClick={confirmDelete}
                        >
                            {deleting && <Spinner />}
                            Delete match
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            Create your first fixture to start scheduling
                            matches for the season.
                        </p>
                        <Button asChild className="mt-2">
                            <Link href={create()}>New fixture</Link>
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="border-sidebar-border/70 dark:border-sidebar-border hidden rounded-xl border sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Opponent</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fixtures.map((fixture) => (
                                        <TableRow key={fixture.id}>
                                            <TableCell
                                                className="hover:bg-muted/50 cursor-pointer"
                                                onClick={() =>
                                                    router.visit(
                                                        `/fixtures/${fixture.id}/match`,
                                                    )
                                                }
                                            >
                                                <FixtureDate
                                                    playedAt={fixture.played_at}
                                                />
                                            </TableCell>
                                            <TableCell
                                                className="hover:bg-muted/50 cursor-pointer font-medium"
                                                onClick={() =>
                                                    router.visit(
                                                        `/fixtures/${fixture.id}/match`,
                                                    )
                                                }
                                            >
                                                {fixture.opponent}
                                            </TableCell>
                                            <TableCell
                                                className="hover:bg-muted/50 cursor-pointer"
                                                onClick={() =>
                                                    router.visit(
                                                        `/fixtures/${fixture.id}/match`,
                                                    )
                                                }
                                            >
                                                <FixtureStatusBadge
                                                    playedAt={fixture.played_at}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDeleteTarget(fixture)
                                                    }
                                                >
                                                    Delete
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="space-y-3 sm:hidden">
                            {fixtures.map((fixture) => (
                                <div
                                    key={fixture.id}
                                    className="border-sidebar-border/70 dark:border-sidebar-border rounded-xl border p-4"
                                >
                                    <Link
                                        href={`/fixtures/${fixture.id}/match`}
                                        className="hover:bg-muted/50 block rounded-lg transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-base font-semibold">
                                                    {fixture.opponent}
                                                </p>
                                                <FixtureDate
                                                    playedAt={fixture.played_at}
                                                    className="mt-1 block text-sm"
                                                />
                                            </div>
                                            <FixtureStatusBadge
                                                playedAt={fixture.played_at}
                                            />
                                        </div>
                                    </Link>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="mt-3 min-h-11 w-full"
                                        onClick={() =>
                                            setDeleteTarget(fixture)
                                        }
                                    >
                                        Delete match
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </>
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
