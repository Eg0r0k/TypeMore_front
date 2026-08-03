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

/**
 * Identifier of ONE run's clock. The store increments it on every `setup` /
 * `reset`, hands it to `start`, and the worker echoes it back on every tick, so
 * a tick can be matched to the run it was armed for.
 *
 * It exists because the two are not otherwise connected. A tick already posted
 * when the main thread replaces the run (a restart is asynchronous — it awaits a
 * dictionary or a quote — and the old worker keeps ticking throughout) is
 * delivered against whatever core is current by then, and its `elapsedMs` is
 * then charged to a clock it never measured. With the durations differing —
 * which is the ordinary case, since changing `time` mid-run is what triggers the
 * rebuild — a stale 30s elapsed lands on a fresh 15s run and finishes it before
 * its first letter. Message ORDER cannot rule that out: user-input tasks are
 * prioritised over worker messages, so the keystroke that starts the new run can
 * overtake a tick queued before it.
 */
export type RunEpoch = number

/** Commands sent from the main thread to the worker. */
export type TimerCommand =
  | { readonly cmd: 'start'; readonly durationMs: number; readonly epoch: RunEpoch }
  | { readonly cmd: 'stop' }
  | { readonly cmd: 'reset' }

/** Message posted from the worker to the main thread. `elapsedMs` is a delta from `start`. */
export interface TimerTick {
  readonly type: 'tick'
  readonly elapsedMs: number
  /** The run this tick measures — echoed verbatim from the `start` that armed it. */
  readonly epoch: RunEpoch
}

/**
 * Delay in ms until tick `tickIndex`, anchored to the ideal grid
 * (`tickIndex * TICK_INTERVAL_MS`) and clamped to the deadline, given how much
 * has already `elapsedMs`. Anchoring to the grid instead of accumulating
 * `+= interval` means a late tick never shifts the ones after it.
 *
 * The clamp AIMS the last tick at the deadline. It does not, and cannot,
 * guarantee it lands at or past it — this comment used to claim it did, and
 * that claim cost a hang. The returned delay is fractional, and `setTimeout`'s
 * `timeout` argument is a WebIDL `long`: `setTimeout(fn, 999.6)` waits 999ms.
 * Every tick therefore loses the fraction of its own delay, so the real grid
 * sits BELOW the ideal one unless the browser hands the fraction back as
 * scheduling slop — and a terminal tick reporting 14999.6 for a 15s run does
 * not satisfy `settle`'s `nowMs >= startedAt + durationMs`, after which the
 * worker stops for good and the run never completes.
 *
 * Landing the last tick is therefore the WORKER's job, not this function's:
 * `timer.worker.ts` reports no less than `durationMs` on the terminal tick.
 * See `tests/timer-worker-deadline.test.ts`.
 */
export function nextTickDelay(elapsedMs: number, tickIndex: number, durationMs: number): number {
  const targetElapsed = Math.min(tickIndex * TICK_INTERVAL_MS, durationMs)
  return Math.max(0, targetElapsed - elapsedMs)
}
