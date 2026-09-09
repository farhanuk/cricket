import { Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Team = {
    id: number;
    name: string;
};

type Fixture = {
    id: number;
    opponent: string;
    overs: number;
    balls_per_over: number;
    first_innings_team_id: number | null;
};

type InningsSummary = {
    id: number;
    sequence: number;
    batting_team_id: number | null;
    is_ours: boolean;
    batting_side_name: string;
    total_runs: number;
    wickets: number;
    is_complete: boolean;
    has_deliveries: boolean;
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
    innings: InningsSummary[];
    result: MatchResult | null;
    match_started: boolean;
};

function inningsActionLabel(innings: InningsSummary): string {
    if (innings.is_complete) {
        return 'View';
    }

    if (innings.has_deliveries) {
        return 'Resume';
    }

    return 'Score';
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

export default function MatchIndex({
    fixture,
    team,
    innings,
    result,
    match_started,
}: PageProps) {
    const startMatch = (batsFirst: 'us' | 'them') => {
        router.post(`/fixtures/${fixture.id}/score`, { bats_first: batsFirst });
    };

    const bothComplete =
        innings.length === 2 &&
        innings.every((entry) => entry.is_complete);

    return (
        <>
            <Head title={`Match vs ${fixture.opponent}`} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title={`vs ${fixture.opponent}`} />

                <div className="border-sidebar-border/70 dark:border-sidebar-border flex flex-wrap gap-2 rounded-xl border p-3">
                    <Button variant="secondary" size="sm" asChild>
                        <Link href={`/fixtures/${fixture.id}/selection`}>
                            Select players
                        </Link>
                    </Button>
                    <Button variant="secondary" size="sm" asChild>
                        <Link href={`/fixtures/${fixture.id}/pairs`}>
                            Batting pairs
                        </Link>
                    </Button>
                </div>

                {!match_started && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Start match</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                Who bats first?
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    className="min-h-12"
                                    onClick={() => startMatch('us')}
                                >
                                    {team.name}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-12"
                                    onClick={() => startMatch('them')}
                                >
                                    {fixture.opponent}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {match_started && (
                    <>
                        {bothComplete && result && (
                            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
                                <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                                    {resultHeadline(
                                        result,
                                        team.name,
                                        fixture.opponent,
                                    )}
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {team.name} {result.our_total} —{' '}
                                    {fixture.opponent} {result.opp_total}
                                </p>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            {innings.map((entry) => (
                                <Card key={entry.id}>
                                    <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                                        <div>
                                            <CardTitle>
                                                {entry.sequence === 1
                                                    ? '1st innings'
                                                    : '2nd innings'}
                                            </CardTitle>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {entry.batting_side_name}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                entry.is_complete
                                                    ? 'secondary'
                                                    : 'default'
                                            }
                                        >
                                            {entry.is_complete
                                                ? 'Complete'
                                                : 'In progress'}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-3xl font-bold tracking-tight">
                                            {entry.total_runs}/{entry.wickets}
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button asChild className="w-full">
                                            <Link
                                                href={`/innings/${entry.id}/score`}
                                            >
                                                {inningsActionLabel(entry)}
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

MatchIndex.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: '/fixtures',
        },
        {
            title: 'Match',
            href: '/fixtures',
        },
    ],
};
