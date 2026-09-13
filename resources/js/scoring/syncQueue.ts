import { appendDelivery, undoLastDelivery } from './deliveryLog';
import type {
    Delivery,
    FlushResult,
    RecordPayload,
    Sender,
    SyncAction,
    SyncError,
} from './types';

export type StorageAdapter = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

function queueKey(inningsId: number): string {
    return `cricket:queue:innings:${inningsId}`;
}

function logKey(inningsId: number): string {
    return `cricket:log:innings:${inningsId}`;
}

function errorsKey(inningsId: number): string {
    return `cricket:errors:innings:${inningsId}`;
}

function readJson<T>(storage: StorageAdapter, key: string, fallback: T): T {
    const raw = storage.getItem(key);

    if (raw === null) {
        return fallback;
    }

    return JSON.parse(raw) as T;
}

function writeJson<T>(storage: StorageAdapter, key: string, value: T): void {
    storage.setItem(key, JSON.stringify(value));
}

export function createSyncQueue(
    inningsId: number,
    storage: StorageAdapter = localStorage,
) {
    const readQueue = (): SyncAction[] =>
        readJson(storage, queueKey(inningsId), [] as SyncAction[]);

    const writeQueue = (queue: SyncAction[]): void => {
        writeJson(storage, queueKey(inningsId), queue);
    };

    const readLog = (): Delivery[] =>
        readJson(storage, logKey(inningsId), [] as Delivery[]);

    const writeLog = (log: Delivery[]): void => {
        writeJson(storage, logKey(inningsId), log);
    };

    const readErrors = (): SyncError[] =>
        readJson(storage, errorsKey(inningsId), [] as SyncError[]);

    const writeErrors = (errors: SyncError[]): void => {
        writeJson(storage, errorsKey(inningsId), errors);
    };

    const enqueue = (action: SyncAction): void => {
        if (action.type === 'record' && action.payload !== undefined) {
            applyRecordToLog(action.payload, action.client_uuid);
        }

        if (action.type === 'undo') {
            applyUndoToLog();
        }

        const queue = readQueue();
        queue.push(action);
        writeQueue(queue);
    };

    const peek = (): SyncAction | null => {
        const queue = readQueue();

        return queue[0] ?? null;
    };

    const dequeue = (): SyncAction | null => {
        const queue = readQueue();

        if (queue.length === 0) {
            return null;
        }

        const [head, ...rest] = queue;
        writeQueue(rest);

        return head;
    };

    const pending = (): SyncAction[] => readQueue();

    const applyRecordToLog = (payload: RecordPayload, clientUuid: string): void => {
        const log = readLog();

        if (log.some((delivery) => delivery.client_uuid === clientUuid)) {
            return;
        }

        writeLog(
            appendDelivery(log, {
                client_uuid: clientUuid,
                striker_id: payload.striker_id ?? null,
                bowler_id: payload.bowler_id ?? null,
                runs: payload.runs,
                is_out: payload.is_out ?? false,
                extra_type: payload.extra_type ?? null,
            }),
        );
    };

    const applyUndoToLog = (): void => {
        writeLog(undoLastDelivery(readLog()));
    };

    const markErrored = (error: SyncError): void => {
        const errors = readErrors();
        errors.push(error);
        writeErrors(errors);
    };

    const flush = async (sender: Sender): Promise<FlushResult> => {
        let flushed = 0;

        while (true) {
            const action = peek();

            if (action === null) {
                return { flushed, stopped: false };
            }

            const result = await sender(action);

            if (result.ok) {
                dequeue();
                flushed++;
                continue;
            }

            if (result.reason === 'validation') {
                markErrored({
                    client_uuid: action.client_uuid,
                    type: 'validation',
                    message: result.message,
                });
                dequeue();

                return {
                    flushed,
                    stopped: true,
                    error: {
                        client_uuid: action.client_uuid,
                        type: 'validation',
                        message: result.message,
                    },
                };
            }

            return {
                flushed,
                stopped: true,
                error: {
                    client_uuid: action.client_uuid,
                    type: 'network',
                    message: result.message,
                },
            };
        }
    };

    return {
        enqueue,
        peek,
        dequeue,
        pending,
        readLog,
        writeLog,
        readErrors,
        flush,
    };
}
