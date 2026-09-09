import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
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

type Season = {
    id: number;
    name: string;
};

type Team = {
    id: number;
    name: string;
};

type TeamRecord = {
    played: number;
    won: number;
    lost: number;
    tied: number;
};

type BattingRow = {
    player: string;
    innings: number;
    runs: number;
    balls: number;
    strike_rate: number;
    fours: number;
    fives: number;
    sixes: number;
    dismissals: number;
    best: number;
};

type BowlingRow = {
    player: string;
    overs: string;
    runs: number;
    wickets: number;
    economy: number;
    wides: number;
    no_balls: number;
    best: string;
};

type PageProps = {
    season: Season;
    team: Team;
    teamRecord: TeamRecord;
    batting: BattingRow[];
    bowling: BowlingRow[];
};

export default function StatsIndex({
    season,
    team,
    teamRecord,
    batting,
    bowling,
}: PageProps) {
    return (
        <>
            <Head title="Season stats" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title={`${team.name} — ${season.name}`} />

                <Card>
                    <CardHeader>
                        <CardTitle>Team record</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                </Card>

                <div>
                    <h2 className="mb-2 text-lg font-semibold">
                        Batting leaderboard
                    </h2>
                    {batting.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No batting stats yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[5rem]">
                                            Player
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            Inns
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            R
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            B
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            SR
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            4
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            5
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            6
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            Out
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            Best
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {batting.map((row) => (
                                        <TableRow key={row.player}>
                                            <TableCell className="px-2 py-2 text-xs font-medium">
                                                {row.player}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.innings}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.runs}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.balls}
                                            </TableCell>
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.strike_rate.toFixed(1)}
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
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.best}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="mb-2 text-lg font-semibold">
                        Bowling leaderboard
                    </h2>
                    {bowling.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No bowling stats yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[5rem]">
                                            Player
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            O
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            R
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            W
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            ECON
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            WD
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            NB
                                        </TableHead>
                                        <TableHead className="w-8 px-1 text-right">
                                            Best
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bowling.map((row) => (
                                        <TableRow key={row.player}>
                                            <TableCell className="px-2 py-2 text-xs font-medium">
                                                {row.player}
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
                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                {row.best}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

StatsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Stats',
            href: '/stats',
        },
    ],
};
