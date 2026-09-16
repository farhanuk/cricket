import { Head, Link, router } from '@inertiajs/react';
import { Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    previousOverBowlerId,
    type OverStripDelivery,
} from '@/scoring/clientFigures';
import { generateClientUuid } from '@/scoring/deliveryLog';
import { countingDeliveriesFromList, deriveState } from '@/scoring/deriveState';
import { createSyncQueue } from '@/scoring/syncQueue';
import type {
    BattingBlockMap,
    Delivery,
    ExtraType,
    Player,
    RecordPayload,
    Sender,
    SyncAction,
} from '@/scoring/types';

const BLOCK_CHECKPOINT_OVERS = [4, 7, 10] as const;
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

type ScoringState = {
    over_no: number;
    balls_bowled_this_over: number;
    balls_per_over: number;
    is_last_over: boolean;
    total_runs: number;
    wickets: number;
    is_complete: boolean;
    balls_remaining: number;
    current_block_number: number | null;
};

type ServerBattingBlock = {
    block_number: number;
    player_a_id: number | null;
    player_b_id: number | null;
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
    selectedPlayers: Player[];
    battingBlocks: ServerBattingBlock[];
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

function toClientDelivery(delivery: ServerDelivery, index: number): Delivery {
    return {
        client_uuid:
            delivery.client_uuid ?? `server-${delivery.id ?? index}-${index}`,
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

function serverBlocksToMap(blocks: ServerBattingBlock[]): BattingBlockMap {
    const map: BattingBlockMap = {};

    for (const block of blocks) {
        if (block.player_a_id !== null && block.player_b_id !== null) {
            map[block.block_number] = {
                player_a_id: block.player_a_id,
                player_b_id: block.player_b_id,
            };
        }
    }

    return map;
}

function seedBlocks(
    sync: ReturnType<typeof createSyncQueue>,
    serverBlocks: ServerBattingBlock[] | undefined,
): BattingBlockMap {
    const stored = sync.readBlocks();
    const hasPendingBlocks = sync
        .pending()
        .some((action) => action.type === 'store_block');

    if (Object.keys(stored).length > 0 || hasPendingBlocks) {
        return stored;
    }

    if (serverBlocks !== undefined) {
        const map = serverBlocksToMap(serverBlocks);
        sync.writeBlocks(map);

        return map;
    }

    return stored;
}

function playersForBlock(
    block: BattingBlockMap[number] | undefined,
    selectedPlayers: Player[],
): Player[] {
    if (block === undefined) {
        return [];
    }

    return selectedPlayers.filter(
        (player) =>
            player.id === block.player_a_id || player.id === block.player_b_id,
    );
}

function createSender(inningsId: number): Sender {
    return async (action) => {
        const csrf = getCsrfToken();
        let url = `/innings/${inningsId}/undo`;
        let body = JSON.stringify({});

        if (action.type === 'record') {
            url = `/innings/${inningsId}/deliveries`;
            body = JSON.stringify({
                ...action.payload,
                client_uuid: action.client_uuid,
            });
        }

        if (action.type === 'store_block') {
            url = `/innings/${inningsId}/blocks`;
            body = JSON.stringify({
                ...action.payload,
                client_uuid: action.client_uuid,
            });
        }

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
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300"
            >
                <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
                Sync error
            </button>
        );
    }

    const inFlight = pendingCount > 0 || isFlushing;
    let label = 'Synced';

    if (!isOnline && pendingCount > 0) {
        label = `Offline (${pendingCount})`;
    } else if (inFlight) {
        label = pendingCount > 0 ? `Saving (${pendingCount})` : 'Saving…';
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                inFlight
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                    : 'border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-200',
            )}
        >
            <span
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    inFlight ? 'bg-amber-500' : 'bg-green-500',
                )}
            />
            {label}
        </span>
    );
}

function CricketBatIcon({ className }: { className?: string }) {
    return (
        <svg
            className={cn(
                'inline-block h-[1em] w-[1em] shrink-0 text-green-600 dark:text-green-500',
                className,
            )}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 80"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M44.55,15.65h0l3.8,3.8h0L60.25,7.55h0a.69.69,0,0,0,1,0l1.39-1.39a.69.69,0,0,0,0-1l-3.8-3.8a.69.69,0,0,0-1,0L56.45,2.77a.69.69,0,0,0,0,1h0Z" />
            <path d="M35.6,30.25l4.08,4.08,8.58-8.58-.89-.89a3.12,3.12,0,0,1-.63-3.52l-4.07-4.07a3.12,3.12,0,0,1-3.52-.63l-.89-.89-2.44,2.44Z" />
            <polygon points="33.65 20.35 31.15 22.85 30.98 32 36.49 37.51 38.17 35.83 33.45 31.11 33.65 20.35" />
            <path d="M28.83,32.87,29,25,1.17,52.83a24.23,24.23,0,0,0,4.3,5.7,24.23,24.23,0,0,0,5.7,4.3L35,39Z" />
        </svg>
    );
}

function CricketBallIcon({ className }: { className?: string }) {
    return (
        <svg
            className={cn(
                'inline-block h-[1em] w-[1em] shrink-0 text-red-800 dark:text-red-700',
                className,
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
            <path
                d="M7.5 4.2 A9 9 0 0 1 7.5 19.8"
                stroke="#fff"
                strokeWidth="1.2"
                fill="none"
            />
            <path
                d="M6.6 6.2 l1.3 .5 M6.1 8.4 l1.4 .3 M6 10.7 l1.4 .1 M6 13.3 l1.4 -.1 M6.1 15.6 l1.4 -.3 M6.6 17.8 l1.3 -.5"
                stroke="#fff"
                strokeWidth="0.9"
            />
        </svg>
    );
}

export default function ScoringIndex(props: PageProps) {
    const { innings, fixture, team, isOurs, players } = props;

    const sync = useMemo(() => createSyncQueue(innings.id), [innings.id]);
    const sender = useMemo(() => createSender(innings.id), [innings.id]);
    const fixtureConfig = useMemo(
        () => ({
            overs: fixture.overs,
            balls_per_over: fixture.balls_per_over,
        }),
        [fixture.overs, fixture.balls_per_over],
    );

    const selectedPlayers = isOurs ? props.selectedPlayers : [];

    const [deliveries, setDeliveries] = useState<Delivery[]>(() =>
        seedLog(sync, props.deliveries),
    );
    const [blockMap, setBlockMap] = useState<BattingBlockMap>(() =>
        isOurs ? seedBlocks(sync, props.battingBlocks) : {},
    );
    const [blockPickIds, setBlockPickIds] = useState<number[]>([]);
    const [blockEditOpen, setBlockEditOpen] = useState(false);
    const [isComplete, setIsComplete] = useState(props.state.is_complete);
    const [pendingCount, setPendingCount] = useState(
        () => sync.pending().length,
    );
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator !== 'undefined' && navigator.onLine,
    );
    const [isFlushing, setIsFlushing] = useState(false);
    const [failedAction, setFailedAction] = useState<FailedAction | null>(null);
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
    );

    const state: ScoringState = {
        ...derived,
        is_complete: isComplete,
    };

    const oversDisplay = useMemo(() => {
        const countingBalls = countingDeliveriesFromList(
            deliveries,
            fixtureConfig,
        );
        const completedOvers = Math.floor(
            countingBalls / fixture.balls_per_over,
        );
        const ballsInCurrentOver = countingBalls % fixture.balls_per_over;

        return `${completedOvers}.${ballsInCurrentOver}`;
    }, [deliveries, fixtureConfig, fixture.balls_per_over]);

    const currentOverDeliveries = currentOverDeliveriesFromLog(
        deliveries,
        fixtureConfig,
    );
    const currentBlockNumber = state.current_block_number ?? 1;
    const currentBlockEntry = blockMap[currentBlockNumber];
    const currentBlockPlayers = useMemo(
        () => playersForBlock(currentBlockEntry, selectedPlayers),
        [currentBlockEntry, selectedPlayers],
    );

    const battingFigures = isOurs
        ? battingFiguresFromLog(
              deliveries,
              fixtureConfig,
              selectedPlayers,
              blockMap,
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

    const [strikerId, setStrikerId] = useState<number | null>(null);
    const [bowlerId, setBowlerId] = useState<number | null>(
        currentOverBowlerIdValue,
    );
    const [bowlerChosenOverNo, setBowlerChosenOverNo] = useState<number | null>(
        !isOurs && currentOverBowlerIdValue !== null ? state.over_no : null,
    );
    const [activeExtra, setActiveExtra] = useState<ExtraType | null>(null);
    const [showOutOptions, setShowOutOptions] = useState(false);
    const [moreRuns, setMoreRuns] = useState('');
    const [acknowledgedCheckpointOvers, setAcknowledgedCheckpointOvers] =
        useState<number[]>([]);

    useEffect(() => {
        if (!isOurs) {
            return;
        }

        if (currentBlockPlayers.length === 0) {
            setStrikerId(null);

            return;
        }

        setStrikerId((current) => {
            if (current === null) {
                return null;
            }

            const blockIds = currentBlockPlayers.map((player) => player.id);

            return blockIds.includes(current) ? current : null;
        });
    }, [currentBlockPlayers, isOurs]);

    useEffect(() => {
        if (isOurs) {
            return;
        }

        if (currentOverBowlerIdValue !== null) {
            setBowlerId((current) =>
                current === currentOverBowlerIdValue
                    ? current
                    : currentOverBowlerIdValue,
            );
            setBowlerChosenOverNo(state.over_no);

            return;
        }

        if (state.balls_bowled_this_over === 0) {
            setBowlerId(null);
            setBowlerChosenOverNo(null);
        }
    }, [
        isOurs,
        currentOverBowlerIdValue,
        state.over_no,
        state.balls_bowled_this_over,
    ]);

    const refreshFromSync = useCallback(() => {
        setDeliveries([...sync.readLog()]);
        setBlockMap({ ...sync.readBlocks() });
        setPendingCount(sync.pending().length);
    }, [sync]);

    const reconcile = useCallback(() => {
        router.reload({
            only: [
                'state',
                'deliveries',
                'battingBlocks',
                'selectedPlayers',
                'lastStrikerId',
                'currentOverBowlerId',
                'previousOverBowlerId',
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

                if (nextProps.isOurs && sync.pending().length === 0) {
                    const map = serverBlocksToMap(nextProps.battingBlocks);
                    sync.writeBlocks(map);
                    setBlockMap(map);
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

    const usedInOtherBlocks = useMemo(() => {
        const ids = new Set<number>();

        for (const [blockNumber, entry] of Object.entries(blockMap)) {
            if (Number(blockNumber) === currentBlockNumber) {
                continue;
            }

            ids.add(entry.player_a_id);
            ids.add(entry.player_b_id);
        }

        return ids;
    }, [blockMap, currentBlockNumber]);

    const availableForBlock = selectedPlayers.filter(
        (player) => !usedInOtherBlocks.has(player.id),
    );

    const canPickBlockPair = availableForBlock.length >= 2;

    const blockRequiredActive =
        isOurs && !state.is_complete && currentBlockEntry === undefined;

    const blockSelectionOpen = blockRequiredActive || blockEditOpen;

    const showEditBatsmenControl =
        isOurs &&
        !state.is_complete &&
        currentBlockEntry !== undefined &&
        !blockRequiredActive;

    const blockCheckpointActive =
        isOurs &&
        BLOCK_CHECKPOINT_OVERS.includes(
            state.over_no as (typeof BLOCK_CHECKPOINT_OVERS)[number],
        ) &&
        state.balls_bowled_this_over === 0 &&
        !acknowledgedCheckpointOvers.includes(state.over_no) &&
        currentBlockEntry !== undefined;

    const acknowledgeBlockCheckpoint = () => {
        setAcknowledgedCheckpointOvers((current) =>
            current.includes(state.over_no)
                ? current
                : [...current, state.over_no],
        );
    };

    const toggleBlockPick = (playerId: number) => {
        setBlockPickIds((current) => {
            if (current.includes(playerId)) {
                return current.filter((id) => id !== playerId);
            }

            if (current.length >= 2) {
                return current;
            }

            return [...current, playerId];
        });
    };

    const confirmBlockSelection = () => {
        if (blockPickIds.length !== 2) {
            return;
        }

        const [playerAId, playerBId] = blockPickIds;

        sync.enqueue({
            type: 'store_block',
            client_uuid: generateClientUuid(),
            payload: {
                block_number: currentBlockNumber,
                player_a_id: playerAId,
                player_b_id: playerBId,
            },
        });

        refreshFromSync();
        setBlockPickIds([]);
        setBlockEditOpen(false);
        setStrikerId(null);
        void runFlush();
    };

    const openBlockEdit = () => {
        if (currentBlockEntry === undefined) {
            return;
        }

        setBlockPickIds([
            currentBlockEntry.player_a_id,
            currentBlockEntry.player_b_id,
        ]);
        setBlockEditOpen(true);
    };

    const blockPlayerIds = currentBlockPlayers.map((player) => player.id);
    const strikerSelected =
        strikerId !== null && blockPlayerIds.includes(strikerId);
    const bowlerForCurrentOver = useMemo(() => {
        if (isOurs) {
            return null;
        }

        if (currentOverBowlerIdValue !== null) {
            return currentOverBowlerIdValue;
        }

        if (bowlerId !== null && bowlerChosenOverNo === state.over_no) {
            return bowlerId;
        }

        return null;
    }, [
        isOurs,
        currentOverBowlerIdValue,
        bowlerId,
        bowlerChosenOverNo,
        state.over_no,
    ]);
    const bowlerSelected = bowlerForCurrentOver !== null;
    const inputsLocked = state.is_complete || state.balls_remaining === 0;
    const scorerReady = isOurs ? strikerSelected : bowlerSelected;
    const scoringEnabled =
        !inputsLocked &&
        scorerReady &&
        failedAction === null &&
        !blockRequiredActive;
    const strikerPickRequired =
        isOurs &&
        !inputsLocked &&
        !blockRequiredActive &&
        currentBlockPlayers.length >= 2 &&
        !strikerSelected;
    const battingSideName = isOurs ? team.name : fixture.opponent;
    const bowlingSideName = isOurs ? fixture.opponent : team.name;
    const currentBowler = players.find(
        (player) => player.id === bowlerForCurrentOver,
    );

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

        if (!isOurs && bowlerForCurrentOver === null) {
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
                  bowler_id: bowlerForCurrentOver,
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

        if (isOurs) {
            setStrikerId(null);
        }

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

        if (isOurs) {
            setStrikerId(null);
        }

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
        } else if (failedAction.action.type === 'store_block') {
            const blocks = { ...sync.readBlocks() };
            const blockNumber = failedAction.action.payload?.block_number;

            if (blockNumber !== undefined) {
                delete blocks[blockNumber];
                sync.writeBlocks(blocks);
            }
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
        if (failedAction === null) {
            return;
        }

        if (
            failedAction.action.type !== 'record' &&
            failedAction.action.type !== 'store_block'
        ) {
            return;
        }

        const payload = failedAction.action.payload;

        discardFailedAction();

        if (payload !== undefined) {
            sync.enqueue({
                type: failedAction.action.type,
                client_uuid: generateClientUuid(),
                payload,
            } as SyncAction);

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

        if (failedAction.action.type === 'store_block') {
            const payload = failedAction.action.payload;

            return payload
                ? `Block ${payload.block_number} batsmen`
                : 'Batting block';
        }

        return 'Undo last ball';
    };

    useEffect(() => {
        if (blockRequiredActive) {
            setBlockPickIds([]);
            setBlockEditOpen(false);
        }
    }, [currentBlockNumber, blockRequiredActive]);

    useEffect(() => {
        setBlockEditOpen(false);
    }, [currentBlockNumber]);

    return (
        <>
            <Head title={`Score vs ${fixture.opponent}`} />

            <Dialog
                open={blockSelectionOpen}
                onOpenChange={(open) => {
                    if (!open && !blockRequiredActive) {
                        setBlockEditOpen(false);
                        setBlockPickIds([]);
                    }
                }}
            >
                <DialogContent
                    className={
                        blockRequiredActive
                            ? '[&>button.absolute]:hidden'
                            : undefined
                    }
                    onInteractOutside={(event) => {
                        if (blockRequiredActive) {
                            event.preventDefault();
                        }
                    }}
                    onEscapeKeyDown={(event) => {
                        if (blockRequiredActive) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>
                            Choose batsmen for block {currentBlockNumber}
                        </DialogTitle>
                        <DialogDescription>
                            Pick two different players from those still
                            available. Each player bats one block only.
                        </DialogDescription>
                    </DialogHeader>
                    {canPickBlockPair ? (
                        <div className="grid gap-2">
                            {availableForBlock.map((player) => (
                                <button
                                    key={player.id}
                                    type="button"
                                    onClick={() => toggleBlockPick(player.id)}
                                    className={cn(
                                        'min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                                        blockPickIds.includes(player.id)
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-input hover:bg-muted',
                                    )}
                                >
                                    {player.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No players selected for this match yet.
                        </p>
                    )}
                    <DialogFooter className="gap-2 sm:gap-2">
                        {!blockRequiredActive && (
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-12 flex-1"
                                onClick={() => {
                                    setBlockEditOpen(false);
                                    setBlockPickIds([]);
                                }}
                            >
                                Cancel
                            </Button>
                        )}
                        {canPickBlockPair ? (
                            <Button
                                type="button"
                                className="min-h-12 flex-1"
                                disabled={blockPickIds.length !== 2}
                                onClick={confirmBlockSelection}
                            >
                                {blockRequiredActive
                                    ? 'Start block'
                                    : 'Save batsmen'}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                className="min-h-12 w-full"
                                asChild
                            >
                                <Link
                                    href={`/fixtures/${fixture.id}/selection`}
                                >
                                    Select squad
                                </Link>
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={blockCheckpointActive}>
                <DialogContent
                    className="[&>button.absolute]:hidden"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Next batting block</DialogTitle>
                        {currentBlockPlayers.length >= 2 && (
                            <DialogDescription className="text-base">
                                Block {currentBlockNumber} —{' '}
                                {currentBlockPlayers
                                    .map((player) => player.name)
                                    .join(' & ')}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            className="min-h-12 w-full"
                            onClick={acknowledgeBlockCheckpoint}
                        >
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showErrorReview} onOpenChange={setShowErrorReview}>
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
                        {(failedAction?.action.type === 'record' ||
                            failedAction?.action.type === 'store_block') && (
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

            <div className="mx-auto flex min-h-full w-full max-w-lg flex-col pb-6">
                <div className="bg-background/95 sticky top-0 z-10 border-b px-4 py-2.5 backdrop-blur">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="text-3xl leading-none font-bold tracking-tight">
                                {state.total_runs}/{state.wickets}
                            </p>
                            <span className="text-lg leading-none font-semibold text-blue-600 dark:text-blue-400">
                                {oversDisplay}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {state.is_last_over && !state.is_complete && (
                                <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                    LAST OVER
                                </Badge>
                            )}
                            <SyncIndicator
                                pendingCount={pendingCount}
                                isOnline={isOnline}
                                isFlushing={isFlushing}
                                failedAction={failedAction}
                                onReview={() => setShowErrorReview(true)}
                            />
                        </div>
                    </div>
                    <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium">
                        <CricketBatIcon />
                        <span>{battingSideName}</span>
                        <span className="text-muted-foreground/80">vs</span>
                        <span>{bowlingSideName}</span>
                        <CricketBallIcon />
                    </p>
                    {!isOurs && currentBowler && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            Bowler: {currentBowler.name}
                        </p>
                    )}
                    <div className="mt-2">
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
                    {isOurs && currentBlockPlayers.length >= 2 && (
                        <div className="space-y-1.5">
                            {showEditBatsmenControl && (
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground size-8"
                                        onClick={openBlockEdit}
                                        aria-label="Edit batsmen"
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                </div>
                            )}
                            <div
                                className={cn(
                                    'space-y-2 rounded-xl border p-3',
                                    strikerPickRequired
                                        ? 'border-primary/50 bg-primary/5'
                                        : 'border-transparent p-0',
                                )}
                            >
                                {strikerPickRequired && (
                                    <p className="text-center text-sm font-semibold">
                                        Select the striker for this ball
                                    </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {currentBlockPlayers.map((player) => {
                                        const isStriker =
                                            strikerId === player.id;

                                        return (
                                            <button
                                                key={player.id}
                                                type="button"
                                                disabled={inputsLocked}
                                                onClick={() =>
                                                    setStrikerId(player.id)
                                                }
                                                className={cn(
                                                    'min-h-12 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                                                    isStriker
                                                        ? 'text-foreground border-green-600/50 bg-green-500/10 dark:border-green-500/40 dark:bg-green-500/15'
                                                        : 'border-input bg-background hover:bg-muted',
                                                    strikerPickRequired &&
                                                        !isStriker &&
                                                        'border-muted-foreground/20',
                                                    inputsLocked &&
                                                        'cursor-not-allowed opacity-50',
                                                )}
                                            >
                                                <span className="flex items-center gap-1.5 text-base font-semibold">
                                                    {isStriker && (
                                                        <CricketBatIcon className="size-3.5 shrink-0" />
                                                    )}
                                                    {player.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {!isOurs && (
                        <div className="space-y-2">
                            <Label htmlFor="bowler">Bowler this over</Label>
                            <Select
                                value={
                                    bowlerForCurrentOver !== null
                                        ? String(bowlerForCurrentOver)
                                        : undefined
                                }
                                onValueChange={(value) => {
                                    setBowlerId(Number(value));
                                    setBowlerChosenOverNo(state.over_no);
                                }}
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
                                            {player.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!scorerReady && !inputsLocked && !isOurs && (
                        <p className="text-muted-foreground text-center text-sm">
                            Select a bowler for this over
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
