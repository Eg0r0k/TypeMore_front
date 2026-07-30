import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Standalone config: runnable both through the root workspace run (a `projects`
// entry of the app's vitest.config.ts) and directly via
// `pnpm --filter @typemore/core test`. No Vue pipeline — the core is
// framework-free, its tests need no plugins.
export default defineConfig({
  resolve: {
    alias: {
      // Tests import the package by its PUBLIC name, exactly like a consumer.
      // The alias mirrors the package.json exports map ('.' -> src/index.ts).
      '@typemore/core': fileURLToPath(new URL('./src/index.ts', import.meta.url))
    }
  },
  test: {
    name: 'core',
    // happy-dom, matching the app suite these tests ran under before the
    // extraction — identical environment, identical numbers. Files that must
    // prove the core runs without a DOM (purity.test.ts) pin
    // `@vitest-environment node` per file, as before.
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
    root: fileURLToPath(new URL('./', import.meta.url))
  }
})
