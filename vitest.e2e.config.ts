import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __PKG_VERSION__: '"0.0.0-e2e"',
  },
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
