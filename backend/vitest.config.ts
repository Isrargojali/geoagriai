import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:../database/geoagri-test.db',
      JWT_ACCESS_SECRET: 'test-access-secret-value',
      JWT_REFRESH_SECRET: 'test-refresh-secret-value',
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    // API tests share one SQLite database — run files sequentially.
    fileParallelism: false,
  },
});
