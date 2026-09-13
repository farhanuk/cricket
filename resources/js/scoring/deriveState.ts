import type {
    Delivery,
    DerivedState,
    FixtureConfig,
    InningsType,
    Pair,
} from './types';

// Single pass: walk deliveries once, tracking the running count of
// deliveries that count toward the over. A delivery counts UNLESS it is a
// wide/no-ball in the last over (re-bowled). The current over is derived
// from the running count as we go — no recursion, no re-slicing.
export function countingDeliveriesFromList(
    deliveries: Delivery[],
    fixture: FixtureConfig,
): number {
    let count = 0;

    for (const delivery of deliveries) {
        const overNo = Math.floor(count / fixture.balls_per_over) + 1;
        const isLastOver = overNo === fixture.overs;
        const rebowled = isLastOver && delivery.extra_type !== null;

        if (!rebowled) {
            count++;
        }
    }

    return count;
}

export function pairPositionForOver(
    fixture: FixtureConfig,
    overNo: number,
): number {
    const oversPerPair = Math.floor(fixture.overs / 4);

    return Math.min(4, Math.floor((overNo - 1) / oversPerPair) + 1);
}

export function deriveState(
    deliveries: Delivery[],
    fixture: FixtureConfig,
    inningsType: InningsType,
    pairs: Pair[] = [],
): DerivedState {
    const countingSoFar = countingDeliveriesFromList(deliveries, fixture);
    const legalBallLimit = fixture.overs * fixture.balls_per_over;
    const overNo = Math.floor(countingSoFar / fixture.balls_per_over) + 1;

    let currentPair: DerivedState['current_pair'] = null;

    if (inningsType === 'ours') {
        const pairPosition = pairPositionForOver(fixture, overNo);
        const pair = pairs.find((entry) => entry.position === pairPosition);

        if (pair !== undefined) {
            currentPair = {
                position: pair.position,
                players: [...pair.players],
            };
        }
    }

    return {
        over_no: overNo,
        balls_bowled_this_over: countingSoFar % fixture.balls_per_over,
        balls_per_over: fixture.balls_per_over,
        is_last_over: overNo === fixture.overs,
        total_runs: deliveries.reduce((sum, d) => sum + d.runs, 0),
        wickets: deliveries.filter((d) => d.is_out).length,
        balls_remaining: Math.max(0, legalBallLimit - countingSoFar),
        current_pair: currentPair,
    };
}
