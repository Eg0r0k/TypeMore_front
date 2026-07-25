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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --port 5178 --host 127.0.0.1',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: true,
    timeout: 60_000
  }
})
