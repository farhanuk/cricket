import { describe, expect, it } from 'vitest';
import {
    blockNumberForOver,
    countingDeliveriesFromList,
    deriveState,
} from './deriveState';
import type { Delivery, FixtureConfig } from './types';

const fixture: FixtureConfig = { overs: 12, balls_per_over: 6 };

function delivery(
    index: number,
    overrides: Partial<Omit<Delivery, 'client_uuid'>> = {},
): Delivery {
    return {
        client_uuid: `550e8400-e29b-41d4-a716-446655440${String(index).padStart(3, '0')}`,
        striker_id: null,
        bowler_id: null,
        runs: 0,
        is_out: false,
        extra_type: null,
        ...overrides,
    };
}

function normalDeliveries(count: number): Delivery[] {
    return Array.from({ length: count }, (_, index) => delivery(index));
}

describe('deriveState', () => {
    it('rolls to over 2 after six normal deliveries', () => {
        const state = deriveState(normalDeliveries(6), fixture, 'ours');

        expect(state.over_no).toBe(2);
        expect(state.balls_bowled_this_over).toBe(0);
    });

    it('counts a wide in over 1 toward the over', () => {
        const deliveries = [
            delivery(0, { runs: 1, extra_type: 'wide' }),
        ];

        expect(countingDeliveriesFromList(deliveries, fixture)).toBe(1);

        const state = deriveState(deliveries, fixture, 'ours');

        expect(state.over_no).toBe(1);
        expect(state.balls_bowled_this_over).toBe(1);
    });

    it('does not count a wide in the last over toward the over', () => {
        const deliveries = [
            ...normalDeliveries(66),
            delivery(66, { runs: 1, extra_type: 'wide' }),
        ];

        expect(countingDeliveriesFromList(deliveries, fixture)).toBe(66);

        const state = deriveState(deliveries, fixture, 'ours');

        expect(state.over_no).toBe(12);
        expect(state.balls_bowled_this_over).toBe(0);
        expect(state.is_last_over).toBe(true);
    });

    it('assigns block 2 in over 4 and block 3 in over 7', () => {
        expect(blockNumberForOver(fixture, 4)).toBe(2);
        expect(blockNumberForOver(fixture, 7)).toBe(3);

        const overFourState = deriveState(
            normalDeliveries(19),
            fixture,
            'ours',
        );

        expect(overFourState.over_no).toBe(4);
        expect(overFourState.current_block_number).toBe(2);

        const overSevenState = deriveState(
            normalDeliveries(37),
            fixture,
            'ours',
        );

        expect(overSevenState.over_no).toBe(7);
        expect(overSevenState.current_block_number).toBe(3);
    });

    it('reduces total runs when an out is recorded with negative runs', () => {
        const deliveries = [
            delivery(0, { striker_id: 1, runs: 10 }),
            delivery(1, { striker_id: 1, runs: -5, is_out: true }),
        ];

        const state = deriveState(deliveries, fixture, 'ours');

        expect(state.total_runs).toBe(5);
        expect(state.wickets).toBe(1);
    });
});
