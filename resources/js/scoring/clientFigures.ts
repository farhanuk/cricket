import { deriveState } from './deriveState';
import type { BattingBlockMap, Delivery, FixtureConfig, Player } from './types';

export type OverStripDelivery = {
    key: string;
    runs: number;
    extra_type: Delivery['extra_type'];
};

export type BattingFigure = {
    player: string;
    runs: number;
    balls: number;
    fours: number;
    fives: number;
    sixes: number;
    dismissals: number;
};

export type BowlingFigure = {
    name: string;
    overs: string;
    runs: number;
    wickets: number;
    economy: number;
    wides: number;
    no_balls: number;
};

function formatOvers(countingBalls: number, ballsPerOver: number): string {
    const completedOvers = Math.floor(countingBalls / ballsPerOver);
    const partialBalls = countingBalls % ballsPerOver;

    return partialBalls === 0
        ? String(completedOvers)
        : `${completedOvers}.${partialBalls}`;
}

function playerLabel(player: Player): string {
    return player.name;
}

function overForDeliveryIndex(
    deliveries: Delivery[],
    fixture: FixtureConfig,
    index: number,
): number {
    let count = 0;

    for (let deliveryIndex = 0; deliveryIndex < index; deliveryIndex++) {
        const delivery = deliveries[deliveryIndex];
        const overNo = Math.floor(count / fixture.balls_per_over) + 1;
        const rebowled =
            overNo === fixture.overs && delivery.extra_type !== null;

        if (!rebowled) {
            count++;
        }
    }

    return Math.floor(count / fixture.balls_per_over) + 1;
}

function countsTowardOver(
    deliveries: Delivery[],
    fixture: FixtureConfig,
    index: number,
): boolean {
    const overNo = overForDeliveryIndex(deliveries, fixture, index);

    return !(overNo === fixture.overs && deliveries[index].extra_type !== null);
}

export function currentOverDeliveriesFromLog(
    deliveries: Delivery[],
    fixture: FixtureConfig,
): OverStripDelivery[] {
    const targetOver = deriveState(deliveries, fixture, 'ours').over_no;
    const strip: OverStripDelivery[] = [];

    for (let index = 0; index < deliveries.length; index++) {
        if (overForDeliveryIndex(deliveries, fixture, index) !== targetOver) {
            continue;
        }

        const delivery = deliveries[index];

        strip.push({
            key: delivery.client_uuid,
            runs: delivery.runs,
            extra_type: delivery.extra_type,
        });
    }

    return strip;
}

export function currentOverStrikerId(
    deliveries: Delivery[],
    fixture: FixtureConfig,
): number | null {
    const targetOver = deriveState(deliveries, fixture, 'ours').over_no;

    for (let index = deliveries.length - 1; index >= 0; index--) {
        const delivery = deliveries[index];

        if (
            overForDeliveryIndex(deliveries, fixture, index) === targetOver &&
            delivery.striker_id !== null
        ) {
            return delivery.striker_id;
        }
    }

    return null;
}

export function currentOverBowlerId(
    deliveries: Delivery[],
    fixture: FixtureConfig,
): number | null {
    const targetOver = deriveState(deliveries, fixture, 'opposition').over_no;

    for (let index = 0; index < deliveries.length; index++) {
        const delivery = deliveries[index];

        if (
            overForDeliveryIndex(deliveries, fixture, index) === targetOver &&
            delivery.bowler_id !== null
        ) {
            return delivery.bowler_id;
        }
    }

    return null;
}

export function previousOverBowlerId(
    deliveries: Delivery[],
    fixture: FixtureConfig,
): number | null {
    const targetOver =
        deriveState(deliveries, fixture, 'opposition').over_no - 1;

    if (targetOver < 1) {
        return null;
    }

    for (let index = deliveries.length - 1; index >= 0; index--) {
        const delivery = deliveries[index];

        if (
            overForDeliveryIndex(deliveries, fixture, index) === targetOver &&
            delivery.bowler_id !== null
        ) {
            return delivery.bowler_id;
        }
    }

    return null;
}

export function battingFiguresFromLog(
    deliveries: Delivery[],
    fixture: FixtureConfig,
    selectedPlayers: Player[],
    blocks: BattingBlockMap,
): BattingFigure[] {
    const battingOrder = new Map<number, { block: number; order: number }>();

    for (const [blockNumber, entry] of Object.entries(blocks)) {
        const block = Number(blockNumber);

        battingOrder.set(entry.player_a_id, { block, order: 0 });
        battingOrder.set(entry.player_b_id, { block, order: 1 });
    }

    const playersById = new Map(
        selectedPlayers.map((player) => [player.id, player]),
    );

    const byStriker = new Map<
        number,
        BattingFigure & { playerId: number; firstIndex: number }
    >();

    deliveries.forEach((delivery, index) => {
        if (delivery.striker_id === null) {
            return;
        }

        const strikerId = delivery.striker_id;
        const player = playersById.get(strikerId);

        if (!byStriker.has(strikerId)) {
            byStriker.set(strikerId, {
                playerId: strikerId,
                player: player ? playerLabel(player) : `Player ${strikerId}`,
                runs: 0,
                balls: 0,
                fours: 0,
                fives: 0,
                sixes: 0,
                dismissals: 0,
                firstIndex: index,
            });
        }

        const stats = byStriker.get(strikerId)!;

        stats.runs += delivery.runs;

        if (countsTowardOver(deliveries, fixture, index)) {
            stats.balls++;
        }

        if (
            delivery.runs === 4 &&
            !delivery.is_out &&
            delivery.extra_type === null
        ) {
            stats.fours++;
        }

        if (
            delivery.runs === 5 &&
            !delivery.is_out &&
            delivery.extra_type === null
        ) {
            stats.fives++;
        }

        if (
            delivery.runs === 6 &&
            !delivery.is_out &&
            delivery.extra_type === null
        ) {
            stats.sixes++;
        }

        if (delivery.is_out) {
            stats.dismissals++;
        }
    });

    return [...byStriker.values()]
        .filter((stats) => stats.balls >= 1)
        .sort((left, right) => {
            const orderLeft = battingOrder.get(left.playerId);
            const orderRight = battingOrder.get(right.playerId);

            if (orderLeft && orderRight) {
                if (orderLeft.block !== orderRight.block) {
                    return orderLeft.block - orderRight.block;
                }

                return orderLeft.order - orderRight.order;
            }

            if (orderLeft) {
                return -1;
            }

            if (orderRight) {
                return 1;
            }

            if (left.runs !== right.runs) {
                return right.runs - left.runs;
            }

            return left.firstIndex - right.firstIndex;
        })
        .map(({ player, runs, balls, fours, fives, sixes, dismissals }) => ({
            player,
            runs,
            balls,
            fours,
            fives,
            sixes,
            dismissals,
        }));
}

export function bowlingFiguresFromLog(
    deliveries: Delivery[],
    fixture: FixtureConfig,
    players: Player[],
): BowlingFigure[] {
    const byBowler = new Map<
        number,
        {
            name: string;
            countingBalls: number;
            runs: number;
            wickets: number;
            wides: number;
            noBalls: number;
        }
    >();

    deliveries.forEach((delivery, index) => {
        if (delivery.bowler_id === null) {
            return;
        }

        const bowlerId = delivery.bowler_id;
        const player = players.find((entry) => entry.id === bowlerId);

        if (!byBowler.has(bowlerId)) {
            byBowler.set(bowlerId, {
                name: player?.name ?? `Player ${bowlerId}`,
                countingBalls: 0,
                runs: 0,
                wickets: 0,
                wides: 0,
                noBalls: 0,
            });
        }

        const stats = byBowler.get(bowlerId)!;

        stats.runs += delivery.runs;

        if (delivery.is_out) {
            stats.wickets++;
        }

        if (delivery.extra_type === 'wide') {
            stats.wides++;
        }

        if (delivery.extra_type === 'no_ball') {
            stats.noBalls++;
        }

        if (countsTowardOver(deliveries, fixture, index)) {
            stats.countingBalls++;
        }
    });

    return [...byBowler.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((stats) => {
            const oversDecimal = stats.countingBalls / fixture.balls_per_over;
            const economy =
                oversDecimal > 0
                    ? Math.round((stats.runs / oversDecimal) * 10) / 10
                    : 0;

            return {
                name: stats.name,
                overs: formatOvers(stats.countingBalls, fixture.balls_per_over),
                runs: stats.runs,
                wickets: stats.wickets,
                economy,
                wides: stats.wides,
                no_balls: stats.noBalls,
            };
        });
}
