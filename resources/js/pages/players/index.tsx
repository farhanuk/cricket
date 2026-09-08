import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
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

export default function PlayersIndex({ players }: PageProps) {
    return (
        <>
            <Head title="Players" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title="Players" />

                <div className="border-sidebar-border/70 dark:border-sidebar-border rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Squad #</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {players.map((player) => (
                                <TableRow key={player.id}>
                                    <TableCell>
                                        {player.squad_number ?? '—'}
                                    </TableCell>
                                    <TableCell>{player.name}</TableCell>
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
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
