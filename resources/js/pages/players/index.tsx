import { Head, router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { index } from '@/routes/players';

type Player = {
    id: number;
    name: string;
    squad_number: number | null;
    active: boolean;
};

type PageProps = {
    players: Player[];
};

type PlayerFormData = {
    name: string;
    squad_number: number | null;
    active: boolean;
};

const emptyForm: PlayerFormData = {
    name: '',
    squad_number: null,
    active: true,
};

export default function PlayersIndex({ players }: PageProps) {
    const [formOpen, setFormOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
    const [deleting, setDeleting] = useState(false);

    const form = useForm<PlayerFormData>(emptyForm);

    const openCreate = () => {
        setEditingPlayer(null);
        form.clearErrors();
        form.setData(emptyForm);
        setFormOpen(true);
    };

    const openEdit = (player: Player) => {
        setEditingPlayer(player);
        form.clearErrors();
        form.setData({
            name: player.name,
            squad_number: player.squad_number,
            active: player.active,
        });
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingPlayer(null);
        form.reset();
    };

    const submitPlayer = (event: FormEvent) => {
        event.preventDefault();

        const payload: PlayerFormData = {
            name: form.data.name,
            squad_number: form.data.squad_number,
            active: form.data.active,
        };

        form.setData(payload);

        if (editingPlayer !== null) {
            form.put(`/players/${editingPlayer.id}`, {
                preserveScroll: true,
                onSuccess: () => closeForm(),
            });

            return;
        }

        form.post('/players', {
            preserveScroll: true,
            onSuccess: () => closeForm(),
        });
    };

    const confirmDelete = () => {
        if (deleteTarget === null) {
            return;
        }

        setDeleting(true);

        router.delete(`/players/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                setDeleteTarget(null);
            },
        });
    };

    return (
        <>
            <Head title="Players" />

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingPlayer ? 'Edit player' : 'Add player'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPlayer
                                ? 'Update player details or active status.'
                                : 'Add a new player to the squad.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitPlayer} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="player-name">Name</Label>
                            <Input
                                id="player-name"
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                                required
                                placeholder="Player name"
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="player-squad-number">
                                Squad number
                            </Label>
                            <Input
                                id="player-squad-number"
                                type="number"
                                min={0}
                                max={999}
                                value={form.data.squad_number ?? ''}
                                onChange={(event) =>
                                    form.setData(
                                        'squad_number',
                                        event.target.value === ''
                                            ? null
                                            : Number(event.target.value),
                                    )
                                }
                                placeholder="Optional"
                            />
                            <InputError message={form.errors.squad_number} />
                        </div>

                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="player-active"
                                checked={form.data.active}
                                onCheckedChange={(checked) =>
                                    form.setData('active', checked === true)
                                }
                            />
                            <Label htmlFor="player-active">Active</Label>
                        </div>
                        <InputError message={form.errors.active} />

                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeForm}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                {editingPlayer ? 'Save changes' : 'Add player'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
                            {deleteTarget?.name
                                ? `Remove ${deleteTarget.name}?`
                                : 'Remove player?'}
                        </DialogTitle>
                        <DialogDescription>
                            Players with match history (selections, pairs, or
                            recorded balls) will be deactivated instead of
                            deleted so stats stay intact.
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
                            Delete / deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                    <Heading title="Players" />
                    <Button type="button" onClick={openCreate}>
                        Add player
                    </Button>
                </div>

                {players.length === 0 ? (
                    <div className="border-sidebar-border/70 dark:border-sidebar-border flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-16 text-center">
                        <p className="text-lg font-medium">No players yet</p>
                        <p className="text-muted-foreground max-w-sm text-sm">
                            Add your first player to start building the squad.
                        </p>
                        <Button
                            type="button"
                            className="mt-2"
                            onClick={openCreate}
                        >
                            Add player
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="border-sidebar-border/70 dark:border-sidebar-border hidden rounded-xl border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Squad #</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {players.map((player) => (
                                        <TableRow key={player.id}>
                                            <TableCell>
                                                {player.squad_number ?? '—'}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {player.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        player.active
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {player.active
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="space-x-2 text-right">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        openEdit(player)
                                                    }
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() =>
                                                        setDeleteTarget(player)
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

                        <div className="space-y-3 md:hidden">
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className="border-sidebar-border/70 dark:border-sidebar-border rounded-xl border p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold">
                                                {player.name}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Squad #
                                                {player.squad_number ?? '—'}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                player.active
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {player.active
                                                ? 'Active'
                                                : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="min-h-11"
                                            onClick={() => openEdit(player)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            className="min-h-11"
                                            onClick={() =>
                                                setDeleteTarget(player)
                                            }
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

PlayersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Players',
            href: index(),
        },
    ],
};
