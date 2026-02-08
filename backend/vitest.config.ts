import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
