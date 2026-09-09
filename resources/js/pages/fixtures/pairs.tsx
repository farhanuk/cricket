import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Fixture = {
    id: number;
    opponent: string;
};

type Player = {
    id: number;
    name: string;
    squad_number: number | null;
};

type ExistingPair = {
    id: number;
    position: number;
    player_a_id: number;
    player_b_id: number;
};

type PairSlot = {
    position: number;
    player_a_id: number | null;
    player_b_id: number | null;
};

type PageProps = {
    fixture: Fixture;
    players: Player[];
    pairs: ExistingPair[];
};

const PAIR_LABELS: Record<number, string> = {
    1: 'Pair 1 (overs 1-3)',
    2: 'Pair 2 (overs 4-6)',
    3: 'Pair 3 (overs 7-9)',
    4: 'Pair 4 (overs 10-12)',
};

function buildInitialPairs(pairs: ExistingPair[]): PairSlot[] {
    return [1, 2, 3, 4].map((position) => {
        const existing = pairs.find((pair) => pair.position === position);

        return {
            position,
            player_a_id: existing?.player_a_id ?? null,
            player_b_id: existing?.player_b_id ?? null,
        };
    });
}

function formatPlayerLabel(player: Player): string {
    return `${player.squad_number ?? '—'} ${player.name}`;
}

function getSelectedIds(
    pairs: PairSlot[],
    excludeIndex: number,
    excludeField: 'player_a_id' | 'player_b_id',
): number[] {
    return pairs.flatMap((pair, index) => {
        const ids: number[] = [];

        if (
            pair.player_a_id !== null &&
            !(index === excludeIndex && excludeField === 'player_a_id')
        ) {
            ids.push(pair.player_a_id);
        }

        if (
            pair.player_b_id !== null &&
            !(index === excludeIndex && excludeField === 'player_b_id')
        ) {
            ids.push(pair.player_b_id);
        }

        return ids;
    });
}

function getAllSelectedIds(pairs: PairSlot[]): number[] {
    return pairs.flatMap((pair) =>
        [pair.player_a_id, pair.player_b_id].filter(
            (id): id is number => id !== null,
        ),
    );
}

export default function FixturesPairs({
    fixture,
    players,
    pairs,
}: PageProps) {
    const form = useForm<{ pairs: PairSlot[] }>({
        pairs: buildInitialPairs(pairs),
    });

    const selectedIds = getAllSelectedIds(form.data.pairs);
    const hasDuplicates =
        selectedIds.length > 0 &&
        selectedIds.length !== new Set(selectedIds).size;
    const isComplete = selectedIds.length === 8;
    const canSave = isComplete && !hasDuplicates && !form.processing;

    const updatePair = (
        index: number,
        field: 'player_a_id' | 'player_b_id',
        value: string,
    ) => {
        const updated = [...form.data.pairs];
        updated[index] = {
            ...updated[index],
            [field]: value ? Number(value) : null,
        };
        form.setData('pairs', updated);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/fixtures/${fixture.id}/pairs`);
    };

    return (
        <>
            <Head title={`Batting pairs vs ${fixture.opponent}`} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title={`Batting pairs vs ${fixture.opponent}`} />

                {hasDuplicates && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Each player can only appear once across all pairs.
                    </p>
                )}

                <form onSubmit={submit} className="max-w-xl space-y-6">
                    <div className="space-y-4">
                        {form.data.pairs.map((pair, index) => (
                            <div
                                key={pair.position}
                                className="border-sidebar-border/70 dark:border-sidebar-border space-y-3 rounded-xl border p-4"
                            >
                                <h3 className="text-sm font-medium">
                                    {PAIR_LABELS[pair.position]}
                                </h3>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor={`pair-${pair.position}-a`}>
                                            Player A
                                        </Label>
                                        <Select
                                            value={pair.player_a_id?.toString()}
                                            onValueChange={(value) =>
                                                updatePair(
                                                    index,
                                                    'player_a_id',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id={`pair-${pair.position}-a`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Select player" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {players.map((player) => (
                                                    <SelectItem
                                                        key={player.id}
                                                        value={player.id.toString()}
                                                        disabled={getSelectedIds(
                                                            form.data.pairs,
                                                            index,
                                                            'player_a_id',
                                                        ).includes(player.id)}
                                                    >
                                                        {formatPlayerLabel(
                                                            player,
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`pair-${pair.position}-b`}>
                                            Player B
                                        </Label>
                                        <Select
                                            value={pair.player_b_id?.toString()}
                                            onValueChange={(value) =>
                                                updatePair(
                                                    index,
                                                    'player_b_id',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id={`pair-${pair.position}-b`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Select player" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {players.map((player) => (
                                                    <SelectItem
                                                        key={player.id}
                                                        value={player.id.toString()}
                                                        disabled={getSelectedIds(
                                                            form.data.pairs,
                                                            index,
                                                            'player_b_id',
                                                        ).includes(player.id)}
                                                    >
                                                        {formatPlayerLabel(
                                                            player,
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <InputError message={form.errors.pairs} />

                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={!canSave}>
                            {form.processing && <Spinner />}
                            Save pairs
                        </Button>
                        <TextLink href="/fixtures">Cancel</TextLink>
                    </div>

                    <p
                        className={cn(
                            'text-sm font-medium',
                            isComplete && !hasDuplicates
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-muted-foreground',
                        )}
                    >
                        {selectedIds.length} of 8 players assigned
                    </p>
                </form>
            </div>
        </>
    );
}

FixturesPairs.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: '/fixtures',
        },
        {
            title: 'Batting pairs',
            href: '/fixtures',
        },
    ],
};
