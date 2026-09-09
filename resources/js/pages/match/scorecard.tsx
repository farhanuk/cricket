import { Head, Link } from '@inertiajs/react';
import MatchHomeButton from '@/components/match-home-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

type Team = {
    id: number;
    name: string;
};

type Fixture = {
    id: number;
    opponent: string;
    played_at: string | null;
    venue: string | null;
};

type BattingRow = {
    player: string;
    runs: number;
    balls: number;
    fours: number;
    fives: number;
    sixes: number;
    dismissals: number;
};

type BowlingRow = {
    name: string;
    overs: string;
    runs: number;
    wickets: number;
    economy: number;
    wides: number;
    no_balls: number;
};

type InningsCard = {
    sequence: number;
    batting_side_name: string;
    bowling_side_name: string;
    total_runs: number;
    wickets: number;
    is_complete: boolean;
    batting: BattingRow[];
    bowling: BowlingRow[];
};

type MatchResult = {
    status: 'ours_win' | 'opposition_win' | 'tie';
    margin: number;
    our_total: number;
    opp_total: number;
};

type PageProps = {
    fixture: Fixture;
    team: Team;
    innings: InningsCard[];
    result: MatchResult | null;
    matchComplete: boolean;
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

function resultHeadline(
    result: MatchResult,
    teamName: string,
    opponent: string,
): string {
    if (result.status === 'ours_win') {
        return `${teamName} won by ${result.margin} runs`;
    }

    if (result.status === 'opposition_win') {
        return `${opponent} won by ${result.margin} runs`;
    }

    return 'Match tied';
}

function BattingTable({ rows }: { rows: BattingRow[] }) {
    if (rows.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">No batters yet</p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[5rem]">Player</TableHead>
                        <TableHead className="w-8 px-1 text-right">R</TableHead>
                        <TableHead className="w-8 px-1 text-right">B</TableHead>
                        <TableHead className="w-8 px-1 text-right">4</TableHead>
                        <TableHead className="w-8 px-1 text-right">5</TableHead>
                        <TableHead className="w-8 px-1 text-right">6</TableHead>
                        <TableHead className="w-8 px-1 text-right">W</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.player}>
                            <TableCell className="px-2 py-2 text-xs font-medium">
                                {row.player}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.runs}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.balls}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.fours}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.fives}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.sixes}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.dismissals}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function BowlingTable({ rows }: { rows: BowlingRow[] }) {
    if (rows.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">No bowlers yet</p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[5rem]">Player</TableHead>
                        <TableHead className="w-8 px-1 text-right">O</TableHead>
                        <TableHead className="w-8 px-1 text-right">R</TableHead>
                        <TableHead className="w-8 px-1 text-right">W</TableHead>
                        <TableHead className="w-8 px-1 text-right">
                            ECON
                        </TableHead>
                        <TableHead className="w-8 px-1 text-right">
                            WD
                        </TableHead>
                        <TableHead className="w-8 px-1 text-right">
                            NB
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.name}>
                            <TableCell className="px-2 py-2 text-xs font-medium">
                                {row.name}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.overs}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.runs}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.wickets}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.economy.toFixed(1)}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.wides}
                            </TableCell>
                            <TableCell className="px-1 py-2 text-right text-xs">
                                {row.no_balls}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function MatchScorecard({
    fixture,
    team,
    innings,
    result,
    matchComplete,
}: PageProps) {
    return (
        <>
            <Head title={`Scorecard vs ${fixture.opponent}`} />

            <MatchHomeButton fixtureId={fixture.id} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {team.name} vs {fixture.opponent}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {formatDate(fixture.played_at)}
                        {fixture.venue ? ` · ${fixture.venue}` : ''}
                    </p>
                </div>

                {matchComplete && result ? (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
                        <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                            {resultHeadline(
                                result,
                                team.name,
                                fixture.opponent,
                            )}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {team.name} {result.our_total} — {fixture.opponent}{' '}
                            {result.opp_total}
                        </p>
                    </div>
                ) : (
                    <Badge variant="secondary" className="w-fit">
                        In progress
                    </Badge>
                )}

                {innings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No innings started yet.
                    </p>
                ) : (
                    <div className="space-y-6">
                        {innings.map((entry) => (
                            <Card key={entry.sequence}>
                                <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                        <span>
                                            {entry.sequence === 1
                                                ? '1st innings'
                                                : '2nd innings'}
                                            : {entry.batting_side_name}{' '}
                                            {entry.total_runs}/{entry.wickets}
                                        </span>
                                        {!entry.is_complete && (
                                            <Badge variant="outline">
                                                In progress
                                            </Badge>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h3 className="mb-2 text-sm font-semibold">
                                            Batting — {entry.batting_side_name}
                                        </h3>
                                        <BattingTable rows={entry.batting} />
                                    </div>
                                    <div>
                                        <h3 className="mb-2 text-sm font-semibold">
                                            Bowling — {entry.bowling_side_name}
                                        </h3>
                                        <BowlingTable rows={entry.bowling} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Button variant="outline" asChild>
                    <Link href={`/fixtures/${fixture.id}/match`}>
                        Back to match
                    </Link>
                </Button>
            </div>
        </>
    );
}

MatchScorecard.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: '/fixtures',
        },
        {
            title: 'Scorecard',
            href: '/fixtures',
        },
    ],
};
