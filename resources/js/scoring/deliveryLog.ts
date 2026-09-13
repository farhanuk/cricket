import type { Delivery } from './types';

export type { Delivery } from './types';

export function generateClientUuid(): string {
    const c: Crypto | undefined =
        typeof crypto !== 'undefined' ? crypto : undefined;

    if (c?.randomUUID) {
        return c.randomUUID();
    }

    const bytes = new Uint8Array(16);

    if (c?.getRandomValues) {
        c.getRandomValues(bytes);
    } else {
        for (let index = 0; index < 16; index++) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));

    return (
        hex.slice(0, 4).join('') +
        '-' +
        hex.slice(4, 6).join('') +
        '-' +
        hex.slice(6, 8).join('') +
        '-' +
        hex.slice(8, 10).join('') +
        '-' +
        hex.slice(10, 16).join('')
    );
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
