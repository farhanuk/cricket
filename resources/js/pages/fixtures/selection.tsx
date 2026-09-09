import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Heading from '@/components/heading';
import MatchHomeButton from '@/components/match-home-button';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Fixture = {
    id: number;
    opponent: string;
    venue: string | null;
    overs: number;
};

type Player = {
    id: number;
    name: string;
    squad_number: number | null;
};

type PageProps = {
    fixture: Fixture;
    players: Player[];
    selectedIds: number[];
};

export default function FixturesSelection({
    fixture,
    players,
    selectedIds,
}: PageProps) {
    const form = useForm<{ player_ids: number[] }>({
        player_ids: selectedIds,
    });

    const selectedCount = form.data.player_ids.length;

    const togglePlayer = (playerId: number) => {
        if (form.data.player_ids.includes(playerId)) {
            form.setData(
                'player_ids',
                form.data.player_ids.filter((id) => id !== playerId),
            );
        } else {
            form.setData('player_ids', [...form.data.player_ids, playerId]);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/fixtures/${fixture.id}/selection`);
    };

    return (
        <>
            <Head title={`Select squad vs ${fixture.opponent}`} />

            <MatchHomeButton fixtureId={fixture.id} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title={`Select squad vs ${fixture.opponent}`} />

                <p
                    className={cn(
                        'text-sm font-medium',
                        selectedCount === 8
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-muted-foreground',
                    )}
                >
                    {selectedCount} selected
                </p>

                <form onSubmit={submit} className="max-w-xl space-y-6">
                    <div className="border-sidebar-border/70 dark:border-sidebar-border divide-y rounded-xl border">
                        {players.map((player) => {
                            const selected = form.data.player_ids.includes(
                                player.id,
                            );

                            return (
                                <button
                                    key={player.id}
                                    type="button"
                                    onClick={() => togglePlayer(player.id)}
                                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors"
                                >
                                    <span>
                                        {player.squad_number ?? '—'}{' '}
                                        {player.name}
                                    </span>
                                    <Checkbox
                                        checked={selected}
                                        className="pointer-events-none"
                                    />
                                </button>
                            );
                        })}
                    </div>

                    <InputError message={form.errors.player_ids} />

                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Save selection
                        </Button>
                        <TextLink href="/fixtures">Cancel</TextLink>
                    </div>
                </form>
            </div>
        </>
    );
}

FixturesSelection.layout = {
    breadcrumbs: [
        {
            title: 'Fixtures',
            href: '/fixtures',
        },
        {
            title: 'Select squad',
            href: '/fixtures',
        },
    ],
};
