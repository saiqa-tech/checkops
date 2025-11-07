import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/setup.ts'],
    teardownTimeout: 30000,
    testTimeout: 30000,
    hookTimeout: 30000
  },
  coverage: {
    enabled: false
  }
});