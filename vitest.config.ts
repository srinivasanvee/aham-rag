import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    // Run test files in separate worker processes so each file gets a clean module registry
    pool: 'forks',
  }
})
