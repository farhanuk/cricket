import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['resources/js/**/*.test.ts'],
        pool: 'forks',
        testTimeout: 5000,
    },
});
