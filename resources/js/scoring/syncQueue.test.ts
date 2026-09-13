import { describe, expect, it, vi } from 'vitest';
import { createSyncQueue, type StorageAdapter } from './syncQueue';
import type { Sender, SyncAction } from './types';

class MemoryStorage implements StorageAdapter {
    private store = new Map<string, string>();

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }
}

function action(type: SyncAction['type'], clientUuid: string): SyncAction {
    return {
        type,
        client_uuid: clientUuid,
        payload: type === 'record' ? { runs: 1, striker_id: 1 } : undefined,
    };
}

describe('syncQueue', () => {
    it('processes enqueue and dequeue in FIFO order', () => {
        const storage = new MemoryStorage();
        const queue = createSyncQueue(42, storage);

        queue.enqueue(action('record', 'uuid-1'));
        queue.enqueue(action('record', 'uuid-2'));
        queue.enqueue(action('undo', 'uuid-3'));

        expect(queue.pending()).toHaveLength(3);
        expect(queue.peek()?.client_uuid).toBe('uuid-1');

        expect(queue.dequeue()?.client_uuid).toBe('uuid-1');
        expect(queue.dequeue()?.client_uuid).toBe('uuid-2');
        expect(queue.peek()?.client_uuid).toBe('uuid-3');
        expect(queue.dequeue()?.client_uuid).toBe('uuid-3');
        expect(queue.peek()).toBeNull();
    });

    it('stops flush on network failure and keeps the failed item queued', async () => {
        const storage = new MemoryStorage();
        const queue = createSyncQueue(7, storage);

        queue.enqueue(action('record', 'uuid-1'));
        queue.enqueue(action('record', 'uuid-2'));

        const sender = vi.fn<Sender>(async (nextAction) => {
            if (nextAction.client_uuid === 'uuid-2') {
                return {
                    ok: false as const,
                    reason: 'network',
                    message: 'offline',
                };
            }

            return { ok: true as const };
        });

        const result = await queue.flush(sender);

        expect(result.flushed).toBe(1);
        expect(result.stopped).toBe(true);
        expect(result.error?.type).toBe('network');
        expect(result.error?.client_uuid).toBe('uuid-2');
        expect(queue.pending()).toHaveLength(1);
        expect(queue.peek()?.client_uuid).toBe('uuid-2');
    });

    it('continues flush after a later successful attempt', async () => {
        const storage = new MemoryStorage();
        const queue = createSyncQueue(8, storage);

        queue.enqueue(action('record', 'uuid-1'));
        queue.enqueue(action('record', 'uuid-2'));

        let attempts = 0;
        const sender: Sender = async (nextAction) => {
            attempts++;

            if (nextAction.client_uuid === 'uuid-1' && attempts === 1) {
                return { ok: false as const, reason: 'network' };
            }

            return { ok: true as const };
        };

        const firstAttempt = await queue.flush(sender);

        expect(firstAttempt.flushed).toBe(0);
        expect(firstAttempt.stopped).toBe(true);
        expect(queue.pending()).toHaveLength(2);

        const secondAttempt = await queue.flush(sender);

        expect(secondAttempt.flushed).toBe(2);
        expect(secondAttempt.stopped).toBe(false);
        expect(queue.pending()).toHaveLength(0);
    });

    it('marks validation failures as errored and removes them from the queue', async () => {
        const storage = new MemoryStorage();
        const queue = createSyncQueue(9, storage);

        queue.enqueue(action('record', 'uuid-bad'));

        const sender: Sender = async () => ({
            ok: false as const,
            reason: 'validation',
            message: 'Invalid striker',
        });

        const result = await queue.flush(sender);

        expect(result.stopped).toBe(true);
        expect(result.error?.type).toBe('validation');
        expect(queue.pending()).toHaveLength(0);
        expect(queue.readErrors()).toEqual([
            {
                client_uuid: 'uuid-bad',
                type: 'validation',
                message: 'Invalid striker',
            },
        ]);
    });

    it('persists log and queue across storage reloads', () => {
        const storage = new MemoryStorage();
        const firstSession = createSyncQueue(99, storage);

        firstSession.enqueue(action('record', 'uuid-a'));
        firstSession.enqueue(action('record', 'uuid-b'));

        const reloaded = createSyncQueue(99, storage);

        expect(reloaded.pending()).toHaveLength(2);
        expect(reloaded.readLog()).toHaveLength(2);
        expect(reloaded.readLog()[0]?.client_uuid).toBe('uuid-a');
        expect(reloaded.readLog()[1]?.client_uuid).toBe('uuid-b');
    });
});
