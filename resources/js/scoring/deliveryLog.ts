import type { Delivery } from './types';

export type { Delivery } from './types';

export function generateClientUuid(): string {
    return crypto.randomUUID();
}

export function appendDelivery(
    log: Delivery[],
    delivery: Delivery,
): Delivery[] {
    return [...log, delivery];
}

export function undoLastDelivery(log: Delivery[]): Delivery[] {
    if (log.length === 0) {
        return log;
    }

    return log.slice(0, -1);
}
