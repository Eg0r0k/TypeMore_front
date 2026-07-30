/**
 * Main-thread wrapper around the timer worker.
 *
 * The concrete worker is injected (`createWorker`) rather than imported here, so
 * this composable stays free of the `?worker` build magic and is unit-testable
 * with a fake worker. Real callers pass `createTimerWorker`.
 *
 * OWNERSHIP: disposal is explicit — the caller that creates the timer owns the
 * worker and must call `dispose()`. There is deliberately no scope-tied
 * auto-disposal: the game store (the real owner) outlives the component whose
 * scope happened to be active when `attachTimer` ran, and tying the worker to
 * that component's scope left the store with a permanently dead timer after a
 * page remount (the store's attach guard blocked re-creation).
 *
 * The only work done on the main thread is the single time-base conversion: the
 * worker's `elapsedMs` delta is already anchored to the first event (the store
 * issues `start` at that instant), so it maps directly onto the event `Ms`
 * timebase. `nowMs` is then handed to the caller, which drives `GameCore.tick`.
 * No absolute worker time is ever compared against event time. See timer.worker.ts.
 */

import { type Ms, type TimerCommand, type TimerTick, asMs } from '@typemore/core'

/**
 * Minimal worker surface the timer needs. The real `Worker` satisfies it; tests
 * supply a fake to exercise the tick → conversion path deterministically.
 */
export interface TimerWorkerLike {
  postMessage(message: TimerCommand): void
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null
  terminate(): void
}

export interface GameTimer {
  start(durationMs: number): void
  stop(): void
  reset(): void
  /** Sink for authoritative ticks; `nowMs` is already in the event `Ms` timebase. */
  onTick(handler: (nowMs: Ms) => void): void
  dispose(): void
}

export function useGameTimer(createWorker: () => TimerWorkerLike): GameTimer {
  const worker = createWorker()
  let handler: ((nowMs: Ms) => void) | null = null

  worker.onmessage = (event) => {
    if (event.data.type !== 'tick') return
    handler?.(asMs(event.data.elapsedMs))
  }

  const timer: GameTimer = {
    start: (durationMs) => worker.postMessage({ cmd: 'start', durationMs }),
    stop: () => worker.postMessage({ cmd: 'stop' }),
    reset: () => worker.postMessage({ cmd: 'reset' }),
    onTick: (fn) => {
      handler = fn
    },
    dispose: () => worker.terminate()
  }

  return timer
}
