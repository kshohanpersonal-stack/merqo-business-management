import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@core': fileURLToPath(new URL('./src/core', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    pool: 'forks',
    reporters: ['default', 'json'],
    outputFile: { json: 'docs/test-results.json' },
    coverage: { provider: 'v8', include: ['src/core/**/*.ts'], reportsDirectory: 'coverage' },
  },
});
