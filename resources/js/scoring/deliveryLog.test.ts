import { describe, expect, it } from 'vitest';
import { appendDelivery, undoLastDelivery } from './deliveryLog';
import type { Delivery } from './types';

const sample = (uuid: string): Delivery => ({
    client_uuid: uuid,
    striker_id: 1,
    bowler_id: null,
    runs: 4,
    is_out: false,
    extra_type: null,
});

describe('deliveryLog', () => {
    it('appends deliveries immutably', () => {
        const log = [sample('a')];
        const next = appendDelivery(log, sample('b'));

        expect(log).toHaveLength(1);
        expect(next).toHaveLength(2);
        expect(next[1]?.client_uuid).toBe('b');
    });

    it('removes the last delivery on undo', () => {
        const log = [sample('a'), sample('b'), sample('c')];
        const next = undoLastDelivery(log);

        expect(next).toHaveLength(2);
        expect(next.at(-1)?.client_uuid).toBe('b');
    });

    it('returns an empty log unchanged when undoing with nothing to remove', () => {
        expect(undoLastDelivery([])).toEqual([]);
    });
});
