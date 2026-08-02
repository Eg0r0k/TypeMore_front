import { defineConfig, devices } from '@playwright/test'

// E2E / performance tests (windowed render budget). Kept out of the Vitest run
// (`vitest.config.ts` excludes `e2e/**`); run with `pnpm test:e2e`.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  // These are BUDGET probes (per-keystroke work, rAF-driven line jumps): two
  // browsers measuring at once contend for the same CPU and the numbers stop
  // meaning anything. `fullyParallel: false` only serializes within a file —
  // this serializes the files too.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    headless: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /*
     * Firefox, for the chat only. The chat field is a `contenteditable` and its
     * emoji are `<img>` elements, and that combination is where the engines
     * actually differ — `plaintext-only` support, how a BROKEN image renders its
     * alt, and whether an image is inline. Every one of those has bitten this
     * file, and none of them shows up in chromium.
     *
     * Deliberately not the whole suite: the perf budgets are calibrated against
     * one engine, and running them twice would halve the machine they measure on.
     */
    {
      name: 'firefox',
      testMatch: /chat-emoji\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  webServer: {
    command: 'pnpm exec vite --port 5178 --host 127.0.0.1',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: true,
    timeout: 60_000
  }
})
