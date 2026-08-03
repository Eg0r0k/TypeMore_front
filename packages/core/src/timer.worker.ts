/**
 * Timer worker — the authoritative cadence for timed tests.
 *
 * ── TIME-BASE CONTRACT (do not break) ─────────────────────────────────────────
 * The worker and the main thread have DIFFERENT `performance.timeOrigin`; their
 * absolute `performance.now()` values are NOT comparable. Therefore:
 *
 *   • The worker NEVER sends an absolute timestamp and NEVER sees the `Ms`
 *     offsets carried by game events. It measures only *elapsed* time from its
 *     own `performance.now()` deltas since it received `start`, and reports that
 *     delta as `elapsedMs`.
 *   • Converting `elapsedMs` into the event `Ms` timebase, and calling `settle`
 *     / `GameCore.tick(nowMs)`, happens ONLY on the main thread, against a single
 *     anchor: the `performance.now()` of the first event (test start). The store
 *     issues `start` at that same instant, so `elapsedMs` is already a delta from
 *     the anchor and drops straight into the event timebase — no cross-timeOrigin
 *     arithmetic ever occurs (deltas carry no origin).
 *
 * ── WHY A WORKER ──────────────────────────────────────────────────────────────
 * A backgrounded / frozen tab throttles or suspends the main event loop, so a
 * main-thread timer would miss the completion check. The worker keeps running;
 * when the main thread wakes it drains the queued tick carrying the true elapsed,
 * and `settle` finishes the test EXACTLY at the deadline — never at the late wake
 * instant.
 *
 * ── METRICS INDEPENDENCE ──────────────────────────────────────────────────────
 * The tick is cadence only. No metric is derived from the number of ticks;
 * durations come from event timestamps and the deadline. Dropping or delaying a
 * tick changes UI smoothness, never the recorded result.
 */
import { TICK_INTERVAL_MS, type TimerCommand, type TimerTick, nextTickDelay } from './timer'

// The dedicated-worker lib is not in the app's DOM tsconfig (and pulling it in
// clashes with DOM globals), so declare the minimal scope surface we use and
// cast `self` to it once, at the boundary.
interface TimerWorkerScope {
  postMessage(message: TimerTick): void
  onmessage: ((event: MessageEvent<TimerCommand>) => void) | null
}
const ctx = self as unknown as TimerWorkerScope

let startPerf = 0
let durationMs = 0
/** The run the current clock belongs to; echoed on every tick. See `RunEpoch`. */
let epoch = 0
let running = false
let timeoutId: ReturnType<typeof setTimeout> | null = null

function clearPending(): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

function scheduleNext(tickIndex: number): void {
  const delay = nextTickDelay(performance.now() - startPerf, tickIndex, durationMs)
  // The tick whose ideal-grid target reaches the deadline is the last one: it
  // fires once at ~deadline and stops. Without this, a `setTimeout` that fires a
  // hair early (elapsed < duration) would keep rescheduling with ~0ms delay and
  // spin out a burst of duplicate ticks right before completion.
  const isTerminal = tickIndex * TICK_INTERVAL_MS >= durationMs
  timeoutId = setTimeout(() => fire(tickIndex, isTerminal), delay)
}

function fire(tickIndex: number, isTerminal: boolean): void {
  if (!running) return
  // Own delta, never an absolute timestamp. The TERMINAL tick additionally
  // reports no less than the full duration, because it is the last one there
  // will ever be: `settle` finishes a timed run on `nowMs >= startedAt +
  // durationMs`, and the tick that was scheduled to land ON the deadline can
  // arrive a sliver before it — `nextTickDelay` returns a fractional delay and
  // `setTimeout`'s argument is a WebIDL `long`, so `setTimeout(fn, 999.6)` waits
  // 999ms. Every tick loses the fraction of its own delay; when the browser does
  // not hand it back as scheduling slop, the grid drifts below the ideal one and
  // the last tick reports e.g. 14999.6 for a 15s run. The worker then stops
  // unconditionally, the run never completes, and the screen hangs on the words
  // forever (see tests/timer-worker-deadline.test.ts).
  //
  // This does not fake time. `settle` pins `finishedAt` to `startedAt +
  // durationMs` — the deadline, never the instant the tick fired — so the
  // finished state is bit-identical whether this tick reports 14999.6, 15000 or
  // 15004.3. What is reported here is the instant the run ENDED, which the
  // deadline defines, not a reading of this clock.
  const measured = performance.now() - startPerf
  const elapsedMs = isTerminal ? Math.max(measured, durationMs) : measured
  const tick: TimerTick = { type: 'tick', elapsedMs, epoch }
  ctx.postMessage(tick)
  if (isTerminal || elapsedMs >= durationMs) {
    running = false
    clearPending()
    return
  }
  scheduleNext(tickIndex + 1)
}

ctx.onmessage = (event: MessageEvent<TimerCommand>): void => {
  const message = event.data
  switch (message.cmd) {
    case 'start':
      clearPending()
      startPerf = performance.now()
      durationMs = message.durationMs
      epoch = message.epoch
      running = true
      scheduleNext(1)
      break
    case 'stop':
    case 'reset':
      running = false
      clearPending()
      break
  }
}
