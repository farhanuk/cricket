import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAIR_CHECKPOINT_OVERS = [4, 7, 10] as const;

type Player = {
    id: number;
    name: string;
    squad_number: number | null;
};

type CurrentPair = {
    position: number;
    players: Player[];
};

type ScoringState = {
    over_no: number;
    balls_bowled_this_over: number;
    balls_per_over: number;
    is_last_over: boolean;
    total_runs: number;
    wickets: number;
    is_complete: boolean;
    balls_remaining: number;
    current_pair: CurrentPair | null;
};

type RecentDelivery = {
    id: number;
    over_no: number;
    ball_no: number | null;
    runs: number;
    is_out: boolean;
    extra_type: 'wide' | 'no_ball' | null;
    striker_id: number | null;
    bowler_id: number | null;
};

type PageProps = {
    innings: {
        id: number;
        batting_side: string;
        sequence: number;
    };
    fixture: {
        id: number;
        opponent: string;
        overs: number;
        balls_per_over: number;
        track_bowling_wickets: boolean;
    };
    team: {
        id: number;
        name: string;
    };
    isOurs: boolean;
    players: Player[];
    state: ScoringState;
    recent: RecentDelivery[];
};

type ExtraType = 'wide' | 'no_ball';

function initialStrikerId(
    recent: RecentDelivery[],
    currentPair: CurrentPair | null,
): number | null {
    const pairIds =
        currentPair?.players.map((player) => player.id) ?? [];

    if (recent[0]?.striker_id && pairIds.includes(recent[0].striker_id)) {
        return recent[0].striker_id;
    }

    return currentPair?.players[0]?.id ?? null;
}

function bowlerForOver(
    recent: RecentDelivery[],
    overNo: number,
): number | null {
    const deliveryInOver = recent.find(
        (delivery) =>
            delivery.over_no === overNo && delivery.bowler_id !== null,
    );

    return deliveryInOver?.bowler_id ?? null;
}

export default function ScoringIndex({
    innings,
    fixture,
    team,
    isOurs,
    players,
    state,
    recent,
}: PageProps) {
    const [strikerId, setStrikerId] = useState<number | null>(() =>
        isOurs ? initialStrikerId(recent, state.current_pair) : null,
    );
    const [bowlerId, setBowlerId] = useState<number | null>(() =>
        isOurs ? null : bowlerForOver(recent, state.over_no),
    );
    const [activeExtra, setActiveExtra] = useState<ExtraType | null>(null);
    const [showOutOptions, setShowOutOptions] = useState(false);
    const [moreRuns, setMoreRuns] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [acknowledgedCheckpointOvers, setAcknowledgedCheckpointOvers] =
        useState<number[]>([]);

    useEffect(() => {
        if (isOurs) {
            setStrikerId(initialStrikerId(recent, state.current_pair));
        } else {
            setBowlerId(bowlerForOver(recent, state.over_no));
        }
    }, [state.over_no, state.current_pair, recent, isOurs]);

    const pairCheckpointActive =
        isOurs &&
        PAIR_CHECKPOINT_OVERS.includes(
            state.over_no as (typeof PAIR_CHECKPOINT_OVERS)[number],
        ) &&
        state.balls_bowled_this_over === 0 &&
        !acknowledgedCheckpointOvers.includes(state.over_no) &&
        state.current_pair !== null;

    const acknowledgePairCheckpoint = () => {
        setAcknowledgedCheckpointOvers((current) =>
            current.includes(state.over_no)
                ? current
                : [...current, state.over_no],
        );
    };

    const pairPlayerIds =
        state.current_pair?.players.map((player) => player.id) ?? [];
    const strikerSelected =
        strikerId !== null && pairPlayerIds.includes(strikerId);
    const bowlerSelected = bowlerId !== null;
    const inputsLocked =
        state.is_complete || state.balls_remaining === 0;
    const scorerReady = isOurs ? strikerSelected : bowlerSelected;
    const scoringEnabled = !inputsLocked && scorerReady && !submitting;
    const showOutControls =
        isOurs || fixture.track_bowling_wickets;
    const battingSideName = isOurs ? team.name : fixture.opponent;
    const currentBowler = players.find((player) => player.id === bowlerId);

    const recordDelivery = (payload: {
        runs: number;
        is_out: boolean;
        extra_type?: ExtraType | null;
    }) => {
        if (!scoringEnabled) {
            return;
        }

        if (isOurs && strikerId === null) {
            return;
        }

        if (!isOurs && bowlerId === null) {
            return;
        }

        setSubmitting(true);

        const body = isOurs
            ? {
                  striker_id: strikerId,
                  runs: payload.runs,
                  is_out: payload.is_out,
                  extra_type: payload.extra_type ?? null,
              }
            : {
                  bowler_id: bowlerId,
                  runs: payload.runs,
                  is_out: payload.is_out,
                  extra_type: payload.extra_type ?? null,
              };

        router.post(`/innings/${innings.id}/deliveries`, body, {
            preserveScroll: true,
            onFinish: () => {
                setSubmitting(false);
                setActiveExtra(null);
                setShowOutOptions(false);
            },
        });
    };

    const recordRun = (runs: number) => {
        recordDelivery({
            runs,
            is_out: false,
            extra_type: activeExtra,
        });
    };

    const recordOut = (runs: number) => {
        recordDelivery({
            runs,
            is_out: true,
            extra_type: null,
        });
    };

    const recordMoreRuns = () => {
        const runs = Number(moreRuns);

        if (Number.isNaN(runs) || runs < -5 || runs > 20) {
            return;
        }

        recordRun(runs);
        setMoreRuns('');
    };

    const undoLast = () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        router.post(
            `/innings/${innings.id}/undo`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const endInnings = () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        router.post(
            `/innings/${innings.id}/complete`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const reopenInnings = () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        router.post(
            `/innings/${innings.id}/reopen`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const toggleExtra = (extra: ExtraType) => {
        setActiveExtra((current) => (current === extra ? null : extra));
    };

    return (
        <>
            <Head title={`Score vs ${fixture.opponent}`} />

            <Dialog open={pairCheckpointActive}>
                <DialogContent
                    className="[&>button.absolute]:hidden"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Next pair coming in</DialogTitle>
                        {state.current_pair && (
                            <DialogDescription className="text-base">
                                Pair {state.current_pair.position} —{' '}
                                {state.current_pair.players
                                    .map((player) => player.name)
                                    .join(' & ')}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-12 flex-1"
                            onClick={() =>
                                router.visit(
                                    `/fixtures/${fixture.id}/pairs`,
                                )
                            }
                        >
                            Manage pairs
                        </Button>
                        <Button
                            type="button"
                            className="min-h-12 flex-1"
                            onClick={acknowledgePairCheckpoint}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="mx-auto flex min-h-full w-full max-w-lg flex-col pb-6">
                <div className="bg-background/95 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-4xl font-bold tracking-tight">
                                {state.total_runs} / {state.wickets}
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Over {state.over_no} of {fixture.overs} · Ball{' '}
                                {state.balls_bowled_this_over}/
                                {state.balls_per_over}
                            </p>
                            <p className="mt-2 text-sm font-medium">
                                {battingSideName} batting · vs{' '}
                                {isOurs ? fixture.opponent : team.name}
                            </p>
                            {!isOurs && currentBowler && (
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Bowler: {currentBowler.name}
                                </p>
                            )}
                        </div>
                        {state.is_last_over && !state.is_complete && (
                            <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                LAST OVER
                            </Badge>
                        )}
                    </div>

                    {isOurs && state.current_pair && (
                        <p className="text-muted-foreground mt-3 text-sm">
                            Pair {state.current_pair.position}:{' '}
                            {state.current_pair.players
                                .map((player) => player.name)
                                .join(' & ')}
                        </p>
                    )}
                </div>

                {state.is_complete && (
                    <div className="mx-4 mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center">
                        <p className="font-semibold text-green-700 dark:text-green-300">
                            Innings complete
                        </p>
                        <p className="text-sm">
                            Final score: {state.total_runs}/{state.wickets}
                        </p>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={reopenInnings}
                            className="text-primary mt-2 text-sm underline underline-offset-4 disabled:opacity-50"
                        >
                            Reopen innings
                        </button>
                    </div>
                )}

                <div className="flex flex-col gap-4 px-4 pt-4">
                    {isOurs && state.current_pair && (
                        <div className="grid grid-cols-2 gap-3">
                            {state.current_pair.players.map((player) => (
                                <button
                                    key={player.id}
                                    type="button"
                                    disabled={inputsLocked}
                                    onClick={() => setStrikerId(player.id)}
                                    className={cn(
                                        'min-h-14 rounded-xl border px-3 py-3 text-left transition-colors',
                                        strikerId === player.id
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-input bg-background hover:bg-muted',
                                        inputsLocked &&
                                            'cursor-not-allowed opacity-50',
                                    )}
                                >
                                    <span className="block text-xs opacity-80">
                                        {player.squad_number ?? '—'}
                                    </span>
                                    <span className="block text-base font-semibold">
                                        {player.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {!isOurs && (
                        <div className="space-y-2">
                            <Label htmlFor="bowler">Bowler this over</Label>
                            <Select
                                value={
                                    bowlerId !== null
                                        ? String(bowlerId)
                                        : undefined
                                }
                                onValueChange={(value) =>
                                    setBowlerId(Number(value))
                                }
                                disabled={
                                    inputsLocked ||
                                    state.balls_bowled_this_over > 0
                                }
                            >
                                <SelectTrigger
                                    id="bowler"
                                    className="min-h-12 w-full"
                                >
                                    <SelectValue placeholder="Select bowler" />
                                </SelectTrigger>
                                <SelectContent>
                                    {players.map((player) => (
                                        <SelectItem
                                            key={player.id}
                                            value={String(player.id)}
                                        >
                                            {player.squad_number ?? '—'} —{' '}
                                            {player.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!scorerReady && !inputsLocked && (
                        <p className="text-muted-foreground text-center text-sm">
                            {isOurs
                                ? 'Select a striker to record runs'
                                : 'Select a bowler for this over'}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant={
                                activeExtra === 'wide' ? 'default' : 'outline'
                            }
                            disabled={!scoringEnabled}
                            className="min-h-12 text-base"
                            onClick={() => toggleExtra('wide')}
                        >
                            Wide
                        </Button>
                        <Button
                            type="button"
                            variant={
                                activeExtra === 'no_ball'
                                    ? 'default'
                                    : 'outline'
                            }
                            disabled={!scoringEnabled}
                            className="min-h-12 text-base"
                            onClick={() => toggleExtra('no_ball')}
                        >
                            No-ball
                        </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                            <button
                                key={runs}
                                type="button"
                                disabled={!scoringEnabled}
                                onClick={() => recordRun(runs)}
                                className={cn(
                                    'bg-primary text-primary-foreground hover:bg-primary/90 min-h-16 rounded-xl text-2xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                )}
                            >
                                {runs}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Input
                            type="number"
                            min={-5}
                            max={20}
                            value={moreRuns}
                            disabled={!scoringEnabled}
                            onChange={(event) =>
                                setMoreRuns(event.target.value)
                            }
                            placeholder="7–20"
                            className="min-h-12 text-lg"
                        />
                        <Button
                            type="button"
                            disabled={!scoringEnabled || moreRuns === ''}
                            className="min-h-12 px-6"
                            onClick={recordMoreRuns}
                        >
                            Record
                        </Button>
                    </div>

                    {showOutControls && (
                        <div className="space-y-3">
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={!scoringEnabled}
                                className="min-h-14 w-full text-lg"
                                onClick={() =>
                                    setShowOutOptions((open) => !open)
                                }
                            >
                                OUT
                            </Button>

                            {showOutOptions && (
                                <div className="grid grid-cols-5 gap-2">
                                    {[-1, -2, -3, -4, -5].map((runs) => (
                                        <button
                                            key={runs}
                                            type="button"
                                            disabled={!scoringEnabled}
                                            onClick={() => recordOut(runs)}
                                            className="bg-destructive hover:bg-destructive/90 min-h-14 rounded-xl text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {runs}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {state.balls_remaining === 0 && !state.is_complete && (
                        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
                            <p className="text-muted-foreground mb-3 text-sm">
                                Over limit reached — end the innings when ready.
                            </p>
                            <Button
                                type="button"
                                disabled={submitting}
                                className="min-h-14 w-full bg-green-600 text-lg hover:bg-green-600/90"
                                onClick={endInnings}
                            >
                                End innings
                            </Button>
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        className="min-h-14 w-full text-base"
                        onClick={undoLast}
                    >
                        Undo last ball
                    </Button>

                    <div>
                        <h2 className="mb-2 text-sm font-semibold">
                            Recent deliveries
                        </h2>
                        {recent.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No deliveries yet
                            </p>
                        ) : (
                            <ul className="divide-y rounded-xl border">
                                {recent.map((delivery) => (
                                    <li
                                        key={delivery.id}
                                        className="flex items-center justify-between px-3 py-2 text-sm"
                                    >
                                        <span className="text-muted-foreground">
                                            {delivery.over_no}.
                                            {delivery.ball_no ?? '-'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {delivery.extra_type === 'wide' && (
                                                <Badge variant="outline">
                                                    wd
                                                </Badge>
                                            )}
                                            {delivery.extra_type ===
                                                'no_ball' && (
                                                <Badge variant="outline">
                                                    nb
                                                </Badge>
                                            )}
                                            {delivery.is_out && (
                                                <Badge variant="destructive">
                                                    W
                                                </Badge>
                                            )}
                                            <span
                                                className={cn(
                                                    'min-w-8 text-right font-semibold',
                                                    delivery.runs < 0 &&
                                                        'bg-destructive rounded px-1.5 text-center text-white',
                                                )}
                                            >
                                                {delivery.runs}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

ScoringIndex.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: '/fixtures',
        },
        {
            title: 'Score',
            href: '/fixtures',
        },
    ],
};
