import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const svg = readFileSync(join(publicDir, 'pwa-icon.svg'));

const sizes = [
    { file: 'pwa-192x192.png', size: 192, padding: 0.12 },
    { file: 'pwa-512x512.png', size: 512, padding: 0.12 },
    { file: 'pwa-512x512-maskable.png', size: 512, padding: 0.22 },
    { file: 'apple-touch-icon.png', size: 180, padding: 0.12 },
];

for (const { file, size, padding } of sizes) {
    const inner = Math.round(size * (1 - padding * 2));

    await sharp(svg)
        .resize(inner, inner, { fit: 'contain' })
        .extend({
            top: Math.round(size * padding),
            bottom: Math.round(size * padding),
            left: Math.round(size * padding),
            right: Math.round(size * padding),
            background: { r: 32, g: 32, b: 35, alpha: 1 },
        })
        .png()
        .toFile(join(publicDir, file));
}

console.log('Generated PWA icons in public/');
