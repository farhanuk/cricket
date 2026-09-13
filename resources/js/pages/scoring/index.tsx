import { Head, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MatchHomeButton from '@/components/match-home-button';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    battingFiguresFromLog,
    bowlingFiguresFromLog,
    currentOverBowlerId,
    currentOverDeliveriesFromLog,
    currentOverStrikerId,
    previousOverBowlerId,
    upcomingPairsFromLog,
    type OverStripDelivery,
} from '@/scoring/clientFigures';
import { generateClientUuid } from '@/scoring/deliveryLog';
import { deriveState } from '@/scoring/deriveState';
import { createSyncQueue } from '@/scoring/syncQueue';
import type {
    Delivery,
    ExtraType,
    Pair,
    Player,
    RecordPayload,
    Sender,
    SyncAction,
} from '@/scoring/types';

const PAIR_CHECKPOINT_OVERS = [4, 7, 10] as const;
const FLUSH_INTERVAL_MS = 5000;

type ServerDelivery = {
    id?: number;
    client_uuid: string | null;
    striker_id: number | null;
    bowler_id: number | null;
    runs: number;
    is_out: boolean;
    extra_type: ExtraType | null;
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

type UpcomingPair = {
    position: number;
    label: string;
};

type BasePageProps = {
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
    };
    team: {
        id: number;
        name: string;
    };
    players: Player[];
    state: ScoringState;
    deliveries?: ServerDelivery[];
};

type OursPageProps = BasePageProps & {
    isOurs: true;
    lastStrikerId: number | null;
    upcomingPairs: UpcomingPair[];
    pairs: { position: number; players: Player[] }[];
};

type OppositionPageProps = BasePageProps & {
    isOurs: false;
};

type PageProps = OursPageProps | OppositionPageProps;

type FailedAction = {
    action: SyncAction;
    message?: string;
    undoneDelivery?: Delivery;
};

function getCsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

function toClientDelivery(
    delivery: ServerDelivery,
    index: number,
): Delivery {
    return {
        client_uuid:
            delivery.client_uuid ??
            `server-${delivery.id ?? index}-${index}`,
        striker_id: delivery.striker_id,
        bowler_id: delivery.bowler_id,
        runs: delivery.runs,
        is_out: delivery.is_out,
        extra_type: delivery.extra_type,
    };
}

function seedLog(
    sync: ReturnType<typeof createSyncQueue>,
    serverDeliveries: ServerDelivery[] | undefined,
): Delivery[] {
    const stored = sync.readLog();
    const pending = sync.pending();

    if (stored.length > 0 || pending.length > 0) {
        return stored;
    }

    if (serverDeliveries !== undefined) {
        const log = serverDeliveries.map(toClientDelivery);
        sync.writeLog(log);

        return log;
    }

    return stored;
}

function buildInitialPairs(props: PageProps): Pair[] {
    if (!props.isOurs) {
        return [];
    }

    return props.pairs
        .filter((pair) => pair.players.length >= 2)
        .map((pair) => ({
            position: pair.position,
            players: [pair.players[0], pair.players[1]] as [Player, Player],
        }))
        .sort((left, right) => left.position - right.position);
}

function mergePair(
    pairs: Pair[],
    next: { position: number; players: Player[] } | null,
): Pair[] {
    if (next === null || next.players.length < 2) {
        return pairs;
    }

    const map = new Map(pairs.map((pair) => [pair.position, pair]));

    map.set(next.position, {
        position: next.position,
        players: [next.players[0], next.players[1]],
    });

    return [...map.values()].sort(
        (left, right) => left.position - right.position,
    );
}

function createSender(inningsId: number): Sender {
    return async (action) => {
        const csrf = getCsrfToken();
        const url =
            action.type === 'record'
                ? `/innings/${inningsId}/deliveries`
                : `/innings/${inningsId}/undo`;

        const body =
            action.type === 'record'
                ? JSON.stringify({
                      ...action.payload,
                      client_uuid: action.client_uuid,
                  })
                : JSON.stringify({});

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': csrf,
                },
                body,
            });

            if (response.ok) {
                return { ok: true as const };
            }

            if (response.status === 422) {
                const data = (await response.json()) as {
                    message?: string;
                    errors?: Record<string, string[]>;
                };
                const message =
                    data.message ??
                    Object.values(data.errors ?? {})
                        .flat()
                        .join(' ');

                return {
                    ok: false as const,
                    reason: 'validation',
                    message: message || 'Validation failed',
                };
            }

            if (response.status >= 400 && response.status < 500) {
                return {
                    ok: false as const,
                    reason: 'validation',
                    message: `Request rejected (${response.status})`,
                };
            }

            return {
                ok: false as const,
                reason: 'network',
                message: `HTTP ${response.status}`,
            };
        } catch (error) {
            return {
                ok: false as const,
                reason: 'network',
                message:
                    error instanceof Error ? error.message : 'Network error',
            };
        }
    };
}

function initialStrikerId(
    lastStrikerId: number | null,
    currentPair: CurrentPair | null,
): number | null {
    const pairIds = currentPair?.players.map((player) => player.id) ?? [];

    if (lastStrikerId !== null && pairIds.includes(lastStrikerId)) {
        return lastStrikerId;
    }

    return currentPair?.players[0]?.id ?? null;
}

function OverStrip({ deliveries }: { deliveries: OverStripDelivery[] }) {
    if (deliveries.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                No balls this over yet
            </p>
        );
    }

    return (
        <div className="flex gap-2 overflow-x-auto py-1">
            {deliveries.map((delivery) => (
                <div
                    key={delivery.key}
                    className={cn(
                        'relative flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                        delivery.runs < 0 && 'bg-red-600',
                        delivery.runs > 0 && 'bg-green-600',
                        delivery.runs === 0 && 'bg-muted-foreground',
                    )}
                >
                    {delivery.runs}
                    {delivery.extra_type && (
                        <span className="bg-background text-foreground absolute -top-1 -right-1 rounded px-0.5 text-[10px] leading-none font-semibold">
                            {delivery.extra_type === 'wide' ? 'wd' : 'nb'}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

function SyncIndicator({
    pendingCount,
    isOnline,
    isFlushing,
    failedAction,
    onReview,
}: {
    pendingCount: number;
    isOnline: boolean;
    isFlushing: boolean;
    failedAction: FailedAction | null;
    onReview: () => void;
}) {
    if (failedAction !== null) {
        return (
            <button
                type="button"
                onClick={onReview}
                className="mt-2 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-sm text-red-700 dark:text-red-300"
            >
                A ball couldn&apos;t be saved — tap to review
            </button>
        );
    }

    let label = 'Synced';

    if (!isOnline && pendingCount > 0) {
        label = `Offline — ${pendingCount} pending`;
    } else if (pendingCount > 0 || isFlushing) {
        label = `Saving… (${pendingCount})`;
    }

    return (
        <p
            className={cn(
                'mt-2 text-xs',
                label === 'Synced'
                    ? 'text-muted-foreground'
                    : 'text-amber-700 dark:text-amber-300',
            )}
        >
            {label}
        </p>
    );
}

export default function ScoringIndex(props: PageProps) {
    const { innings, fixture, team, isOurs, players } = props;

    const sync = useMemo(
        () => createSyncQueue(innings.id),
        [innings.id],
    );
    const sender = useMemo(
        () => createSender(innings.id),
        [innings.id],
    );
    const fixtureConfig = useMemo(
        () => ({
            overs: fixture.overs,
            balls_per_over: fixture.balls_per_over,
        }),
        [fixture.overs, fixture.balls_per_over],
    );

    const [deliveries, setDeliveries] = useState<Delivery[]>(() =>
        seedLog(sync, props.deliveries),
    );
    const [pairs, setPairs] = useState<Pair[]>(() => buildInitialPairs(props));
    const [isComplete, setIsComplete] = useState(props.state.is_complete);
    const [pendingCount, setPendingCount] = useState(() =>
        sync.pending().length,
    );
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator !== 'undefined' && navigator.onLine,
    );
    const [isFlushing, setIsFlushing] = useState(false);
    const [failedAction, setFailedAction] = useState<FailedAction | null>(
        null,
    );
    const [showErrorReview, setShowErrorReview] = useState(false);
    const [showCompleteWarning, setShowCompleteWarning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const flushBlockedRef = useRef(false);
    const flushingRef = useRef(false);
    const lastUndoneDeliveryRef = useRef<Delivery | undefined>(undefined);

    const derived = deriveState(
        deliveries,
        fixtureConfig,
        isOurs ? 'ours' : 'opposition',
        pairs,
    );

    const state: ScoringState = {
        ...derived,
        is_complete: isComplete,
    };

    const currentOverDeliveries = currentOverDeliveriesFromLog(
        deliveries,
        fixtureConfig,
    );
    const lastStrikerId = isOurs
        ? currentOverStrikerId(deliveries, fixtureConfig)
        : null;
    const battingFigures = isOurs
        ? battingFiguresFromLog(deliveries, fixtureConfig, pairs)
        : [];
    const upcomingPairs = isOurs
        ? upcomingPairsFromLog(
              pairs,
              state.current_pair?.position ?? 0,
          )
        : [];
    const currentOverBowlerIdValue = !isOurs
        ? currentOverBowlerId(deliveries, fixtureConfig)
        : null;
    const previousOverBowlerIdValue = !isOurs
        ? previousOverBowlerId(deliveries, fixtureConfig)
        : null;
    const bowlingFigures = !isOurs
        ? bowlingFiguresFromLog(deliveries, fixtureConfig, players)
        : [];

    const [strikerId, setStrikerId] = useState<number | null>(() =>
        isOurs ? initialStrikerId(lastStrikerId, state.current_pair) : null,
    );
    const [bowlerId, setBowlerId] = useState<number | null>(
        currentOverBowlerIdValue,
    );
    const [activeExtra, setActiveExtra] = useState<ExtraType | null>(null);
    const [showOutOptions, setShowOutOptions] = useState(false);
    const [moreRuns, setMoreRuns] = useState('');
    const [acknowledgedCheckpointOvers, setAcknowledgedCheckpointOvers] =
        useState<number[]>([]);

    useEffect(() => {
        if (derived.current_pair !== null) {
            setPairs((current) => mergePair(current, derived.current_pair));
        }
    }, [derived.current_pair]);

    useEffect(() => {
        if (isOurs) {
            if (derived.current_pair === null) {
                return;
            }

            setStrikerId((current) => {
                const pairIds = derived.current_pair!.players.map(
                    (player) => player.id,
                );

                if (current !== null && pairIds.includes(current)) {
                    return current;
                }

                return initialStrikerId(
                    lastStrikerId,
                    derived.current_pair,
                );
            });
        } else {
            setBowlerId(currentOverBowlerIdValue);
        }
    }, [
        derived.over_no,
        derived.current_pair,
        lastStrikerId,
        currentOverBowlerIdValue,
        isOurs,
    ]);

    const refreshFromSync = useCallback(() => {
        setDeliveries([...sync.readLog()]);
        setPendingCount(sync.pending().length);
    }, [sync]);

    const reconcile = useCallback(() => {
        router.reload({
            only: [
                'state',
                'deliveries',
                'pairs',
                'lastStrikerId',
                'currentOverBowlerId',
                'previousOverBowlerId',
                'upcomingPairs',
            ],
            onSuccess: (page) => {
                const nextProps = page.props as unknown as PageProps;

                if (sync.pending().length > 0) {
                    return;
                }

                setIsComplete(nextProps.state.is_complete);

                if (nextProps.deliveries !== undefined) {
                    const log = nextProps.deliveries.map(toClientDelivery);
                    sync.writeLog(log);
                    setDeliveries(log);
                }

                if (nextProps.isOurs) {
                    setPairs(buildInitialPairs(nextProps));
                }
            },
        });
    }, [sync]);

    const runFlush = useCallback(async () => {
        if (
            flushBlockedRef.current ||
            flushingRef.current ||
            sync.pending().length === 0
        ) {
            return;
        }

        flushingRef.current = true;
        setIsFlushing(true);

        const nextAction = sync.peek();

        if (nextAction === null) {
            flushingRef.current = false;
            setIsFlushing(false);

            return;
        }

        try {
            const result = await sync.flush(sender);

            refreshFromSync();

            if (result.error?.type === 'validation') {
                flushBlockedRef.current = true;

                setFailedAction({
                    action: nextAction,
                    message: result.error.message,
                    undoneDelivery:
                        nextAction.type === 'undo'
                            ? lastUndoneDeliveryRef.current
                            : undefined,
                });

                return;
            }

            if (result.error?.type === 'network') {
                return;
            }

            if (sync.pending().length === 0) {
                reconcile();
            }
        } finally {
            flushingRef.current = false;
            setIsFlushing(false);
        }
    }, [reconcile, refreshFromSync, sender, sync]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (failedAction !== null) {
            return;
        }

        void runFlush();

        const intervalId = window.setInterval(() => {
            void runFlush();
        }, FLUSH_INTERVAL_MS);

        const handleOnline = () => {
            void runFlush();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [failedAction, runFlush]);

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
    const inputsLocked = state.is_complete || state.balls_remaining === 0;
    const scorerReady = isOurs ? strikerSelected : bowlerSelected;
    const scoringEnabled =
        !inputsLocked && scorerReady && failedAction === null;
    const battingSideName = isOurs ? team.name : fixture.opponent;
    const currentBowler = players.find((player) => player.id === bowlerId);

    const eligibleBowlers =
        !isOurs && state.balls_bowled_this_over === 0
            ? players.filter(
                  (player) => player.id !== previousOverBowlerIdValue,
              )
            : players;

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

        const clientUuid = generateClientUuid();
        const recordPayload: RecordPayload = isOurs
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

        sync.enqueue({
            type: 'record',
            client_uuid: clientUuid,
            payload: recordPayload,
        });

        refreshFromSync();
        setActiveExtra(null);
        setShowOutOptions(false);
        void runFlush();
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
        const logBefore = sync.readLog();
        lastUndoneDeliveryRef.current = logBefore.at(-1);

        sync.enqueue({
            type: 'undo',
            client_uuid: generateClientUuid(),
        });

        refreshFromSync();
        void runFlush();
    };

    const ensureReadyToComplete = (): boolean => {
        if (failedAction !== null || pendingCount > 0 || isFlushing) {
            setShowCompleteWarning(true);

            return false;
        }

        return true;
    };

    const endInnings = async () => {
        if (submitting) {
            return;
        }

        await runFlush();

        if (!ensureReadyToComplete()) {
            return;
        }

        setSubmitting(true);

        router.post(
            `/innings/${innings.id}/complete`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setIsComplete(true),
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
                onSuccess: () => setIsComplete(false),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    const toggleExtra = (extra: ExtraType) => {
        setActiveExtra((current) => (current === extra ? null : extra));
    };

    const discardFailedAction = () => {
        if (failedAction === null) {
            return;
        }

        const log = sync.readLog();

        if (failedAction.action.type === 'record') {
            sync.writeLog(
                log.filter(
                    (delivery) =>
                        delivery.client_uuid !==
                        failedAction.action.client_uuid,
                ),
            );
        } else if (failedAction.undoneDelivery !== undefined) {
            sync.writeLog([...log, failedAction.undoneDelivery]);
        }

        refreshFromSync();
        flushBlockedRef.current = false;
        setFailedAction(null);
        setShowErrorReview(false);
        void runFlush();
    };

    const retryFailedAction = () => {
        if (failedAction === null || failedAction.action.type !== 'record') {
            return;
        }

        const payload = failedAction.action.payload;

        discardFailedAction();

        if (payload !== undefined) {
            sync.enqueue({
                type: 'record',
                client_uuid: generateClientUuid(),
                payload,
            });

            refreshFromSync();
            void runFlush();
        }
    };

    const failedActionSummary = (): string => {
        if (failedAction === null) {
            return '';
        }

        if (
            failedAction.action.type === 'record' &&
            failedAction.action.payload !== undefined
        ) {
            const payload = failedAction.action.payload;
            const parts = [`${payload.runs} run(s)`];

            if (payload.is_out) {
                parts.push('OUT');
            }

            if (payload.extra_type) {
                parts.push(payload.extra_type.replace('_', ' '));
            }

            return parts.join(' · ');
        }

        return 'Undo last ball';
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
                                router.visit(`/fixtures/${fixture.id}/pairs`)
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

            <Dialog
                open={showErrorReview}
                onOpenChange={setShowErrorReview}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sync error</DialogTitle>
                        <DialogDescription>
                            {failedAction?.message ??
                                'The server rejected this action.'}
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm font-medium">
                        {failedActionSummary()}
                    </p>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-12 flex-1"
                            onClick={discardFailedAction}
                        >
                            Discard local change
                        </Button>
                        {failedAction?.action.type === 'record' && (
                            <Button
                                type="button"
                                className="min-h-12 flex-1"
                                onClick={retryFailedAction}
                            >
                                Retry save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showCompleteWarning}
                onOpenChange={setShowCompleteWarning}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Still syncing</DialogTitle>
                        <DialogDescription>
                            {failedAction !== null
                                ? 'Fix or discard the failed action before ending the innings.'
                                : `${pendingCount} action(s) are still queued. Wait for sync to finish or go offline and retry.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            className="min-h-12 w-full"
                            onClick={() => setShowCompleteWarning(false)}
                        >
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MatchHomeButton fixtureId={fixture.id} />

            <div className="mx-auto flex min-h-full w-full max-w-lg flex-col pb-6">
                <div className="bg-background/95 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
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
                            <SyncIndicator
                                pendingCount={pendingCount}
                                isOnline={isOnline}
                                isFlushing={isFlushing}
                                failedAction={failedAction}
                                onReview={() => setShowErrorReview(true)}
                            />
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

                    <div className="mt-3">
                        <OverStrip deliveries={currentOverDeliveries} />
                    </div>
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
                                    {eligibleBowlers.map((player) => (
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

                    <div className="space-y-3">
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={!scoringEnabled}
                            className="min-h-14 w-full text-lg"
                            onClick={() => setShowOutOptions((open) => !open)}
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

                    {state.balls_remaining === 0 && !state.is_complete && (
                        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
                            <p className="text-muted-foreground mb-3 text-sm">
                                Over limit reached — end the innings when ready.
                            </p>
                            <Button
                                type="button"
                                disabled={submitting}
                                className="min-h-14 w-full bg-green-600 text-lg hover:bg-green-600/90"
                                onClick={() => void endInnings()}
                            >
                                End innings
                            </Button>
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-14 w-full text-base"
                        onClick={undoLast}
                    >
                        Undo last ball
                    </Button>

                    {isOurs ? (
                        <>
                            <div>
                                <h2 className="mb-2 text-sm font-semibold">
                                    Batting figures
                                </h2>
                                {battingFigures.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        No batters yet
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
                                                        R
                                                    </TableHead>
                                                    <TableHead className="w-8 px-1 text-right">
                                                        B
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
                                                        W
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {battingFigures.map(
                                                    (figure) => (
                                                        <TableRow
                                                            key={figure.player}
                                                        >
                                                            <TableCell className="px-2 py-2 text-xs font-medium">
                                                                {figure.player}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {figure.runs}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {figure.balls}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {figure.fours}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {figure.fives}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {figure.sixes}
                                                            </TableCell>
                                                            <TableCell className="px-1 py-2 text-right text-xs">
                                                                {
                                                                    figure.dismissals
                                                                }
                                                            </TableCell>
                                                        </TableRow>
                                                    ),
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h2 className="mb-2 text-sm font-semibold">
                                    Upcoming pairs
                                </h2>
                                {upcomingPairs.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        No more pairs after this block
                                    </p>
                                ) : (
                                    <ul className="divide-y rounded-xl border">
                                        {upcomingPairs.map((pair) => (
                                            <li
                                                key={pair.position}
                                                className="px-3 py-2 text-sm"
                                            >
                                                {pair.label}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    ) : (
                        <div>
                            <h2 className="mb-2 text-sm font-semibold">
                                Bowling figures
                            </h2>
                            {bowlingFigures.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No bowlers yet
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Player</TableHead>
                                                <TableHead className="text-right">
                                                    O
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    R
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    W
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    ECON
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    WD
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    NB
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bowlingFigures.map((figure) => (
                                                <TableRow key={figure.name}>
                                                    <TableCell className="font-medium">
                                                        {figure.name}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.overs}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.runs}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.wickets}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.economy.toFixed(
                                                            1,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.wides}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {figure.no_balls}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
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
