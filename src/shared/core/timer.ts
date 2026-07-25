/**
 * Timer worker message protocol — the shared, framework-free contract between
 * the worker (`timer.worker.ts`) and its main-thread wrapper (`useGameTimer`).
 *
 * Only *relative* time ever crosses the boundary: the worker reports `elapsedMs`
 * (a delta), never an absolute timestamp. See the time-base contract documented
 * in `timer.worker.ts` for why.
 */

/** Cadence of authoritative timer ticks, in ms. */
export const TICK_INTERVAL_MS = 1000

/** Commands sent from the main thread to the worker. */
export type TimerCommand =
  | { readonly cmd: 'start'; readonly durationMs: number }
  | { readonly cmd: 'stop' }
  | { readonly cmd: 'reset' }

/** Message posted from the worker to the main thread. `elapsedMs` is a delta from `start`. */
export interface TimerTick {
  readonly type: 'tick'
  readonly elapsedMs: number
}

/**
 * Delay in ms until tick `tickIndex`, anchored to the ideal grid
 * (`tickIndex * TICK_INTERVAL_MS`) and clamped to the deadline, given how much
 * has already `elapsedMs`. Anchoring to the grid instead of accumulating
 * `+= interval` means a late tick never shifts the ones after it; clamping to
 * the deadline guarantees a final tick lands exactly at completion.
 */
export function nextTickDelay(elapsedMs: number, tickIndex: number, durationMs: number): number {
  const targetElapsed = Math.min(tickIndex * TICK_INTERVAL_MS, durationMs)
  return Math.max(0, targetElapsed - elapsedMs)
}
