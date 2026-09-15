import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { dashboard } from '@/routes';

type TeamRecord = {
    played: number;
    won: number;
    lost: number;
    tied: number;
};

type TopBatsman = {
    name: string;
    runs: number;
    innings: number;
};

type TopBowler = {
    name: string;
    wickets: number;
    overs: string;
};

type RecentFixture = {
    id: number;
    opponent: string;
    played_at: string | null;
    result: string | null;
};

type PageProps = {
    teamRecord: TeamRecord;
    topBatsmen: TopBatsman[];
    topBowlers: TopBowler[];
    recentFixtures: RecentFixture[];
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

export default function Dashboard({
    teamRecord,
    topBatsmen,
    topBowlers,
    recentFixtures,
}: PageProps) {
    return (
        <>
            <Head title="Dashboard" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Season record</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {teamRecord.played === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No matches played yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div>
                                    <p className="text-muted-foreground text-xs uppercase">
                                        Played
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {teamRecord.played}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs uppercase">
                                        Won
                                    </p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {teamRecord.won}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs uppercase">
                                        Lost
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {teamRecord.lost}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs uppercase">
                                        Tied
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {teamRecord.tied}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top batsmen</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topBatsmen.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No batting stats yet.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Player</TableHead>
                                                <TableHead className="text-right">
                                                    R
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Inns
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {topBatsmen.map((row) => (
                                                <TableRow key={row.name}>
                                                    <TableCell className="font-medium">
                                                        {row.name}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {row.runs}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {row.innings}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top bowlers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topBowlers.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No bowling stats yet.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Player</TableHead>
                                                <TableHead className="text-right">
                                                    W
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    O
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {topBowlers.map((row) => (
                                                <TableRow key={row.name}>
                                                    <TableCell className="font-medium">
                                                        {row.name}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {row.wickets}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {row.overs}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent matches</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentFixtures.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No matches played yet.
                            </p>
                        ) : (
                            <ul className="divide-y rounded-xl border">
                                {recentFixtures.map((fixture) => (
                                    <li key={fixture.id}>
                                        <Link
                                            href={`/fixtures/${fixture.id}/match`}
                                            className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    vs {fixture.opponent}
                                                </p>
                                                <p className="text-muted-foreground text-sm">
                                                    {formatDate(
                                                        fixture.played_at,
                                                    )}
                                                </p>
                                            </div>
                                            {fixture.result && (
                                                <p className="text-sm font-medium">
                                                    {fixture.result}
                                                </p>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
