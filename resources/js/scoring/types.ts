export type ExtraType = 'wide' | 'no_ball';

export type Delivery = {
    client_uuid: string;
    striker_id: number | null;
    bowler_id: number | null;
    runs: number;
    is_out: boolean;
    extra_type: ExtraType | null;
};

export type FixtureConfig = {
    overs: number;
    balls_per_over: number;
};

export type Player = {
    id: number;
    name: string;
    squad_number: number | null;
};

export type Pair = {
    position: number;
    players: [Player, Player];
};

export type InningsType = 'ours' | 'opposition';

export type RecordPayload = {
    striker_id?: number | null;
    bowler_id?: number | null;
    runs: number;
    is_out?: boolean;
    extra_type?: ExtraType | null;
};

export type SyncAction = {
    type: 'record' | 'undo';
    client_uuid: string;
    payload?: RecordPayload;
};

export type SenderResult =
    | { ok: true }
    | { ok: false; reason: 'validation' | 'network'; message?: string };

export type Sender = (action: SyncAction) => Promise<SenderResult>;

export type SyncError = {
    client_uuid: string;
    type: 'validation' | 'network';
    message?: string;
};

export type FlushResult = {
    flushed: number;
    stopped: boolean;
    error?: SyncError;
};

export type DerivedState = {
    over_no: number;
    balls_bowled_this_over: number;
    balls_per_over: number;
    is_last_over: boolean;
    total_runs: number;
    wickets: number;
    balls_remaining: number;
    current_pair: {
        position: number;
        players: Player[];
    } | null;
};
