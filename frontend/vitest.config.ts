import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests (src/**/*.test.ts) and the contract self-test of the mocks (tests/*.selftest.ts), both in Node.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.selftest.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120_000,
  },
})
