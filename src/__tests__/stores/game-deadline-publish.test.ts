/**
 * The store must never swallow a time-based completion.
 *
 * `GameCore.dispatch` settles the clock BEFORE it reduces, so a key pressed after
 * a timed run's deadline finishes the core and THEN has its own event rejected
 * (`TestFinished`). The rejection branch of the store's wrappers used to return
 * the seq and stop there, so the freshly finished state was never published:
 * `snapshot` stayed `running` forever, every later key was rejected for the same
 * reason, and the results screen — gated on `phase === 'finished'` — never opened.
 *
 * These tests drive the exact shape of that hang: a timed run whose worker tick
 * never lands (the worker stopped a hair short of the deadline — see
 * `packages/core/tests/timer-worker-deadline.test.ts`), followed by one more
 * keystroke past the deadline. Each of the four dispatching wrappers gets its own
 * case, because each one owns its own copy of the rejection branch.
 */
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, nextTick, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type TimerCommand,
  type TimerTick,
  GameCore,
  asMs,
  insertEvent,
  settle
} from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { useGameStore } from '@entities/game'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  readonly sent: TimerCommand[] = []

  /** The run this clock is armed for — echoed on every tick, like the real worker. */
  epoch = 0

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
    if (message.cmd === 'start') this.epoch = message.epoch
  }

  terminate(): void {}

  emitTick(elapsedMs: number, epoch: number = this.epoch): void {
    this.onmessage?.({
      data: { type: 'tick', elapsedMs, epoch }
    } as unknown as MessageEvent<TimerTick>)
  }
}

const timeConfig: CoreConfig = {
  mode: 'time',
  durationMs: 10_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false
}

let clock = 0
const setClock = (value: number): void => {
  clock = value
}

/**
 * A run started at `t = 0` whose authoritative tick never arrived, wound forward
 * to just past its deadline. The next event the caller dispatches is the one the
 * reducer must reject — and whose settled completion the store must publish.
 */
function armedPastDeadline(id: string, words: readonly string[]): {
  store: ReturnType<typeof useGameStore>
  worker: FakeTimerWorker
} {
  const store = useGameStore(id)
  const worker = new FakeTimerWorker()
  store.attachTimer(() => worker)
  store.setup({ config: timeConfig, words })
  setClock(5_000) // the anchor is captured on the first stamp, so its value is free
  store.insert('a')
  expect(store.phase).toBe('running')
  expect(worker.sent).toContainEqual({ cmd: 'start', durationMs: 10_000, epoch: 1 })
  setClock(5_000 + 10_001) // one ms past `startedAt + durationMs`, no tick delivered
  return { store, worker }
}

describe('settle identity (the signal the store compares against)', () => {
  // The fix publishes when `core.state !== snapshot.value`, which is only sound
  // because `settle` is identity-stable: the SAME object back when it changed
  // nothing, a fresh one from `makeState` when it completed the run.
  it('returns the same object unless it finished the run', () => {
    const ctx: CoreContext = { config: timeConfig, words: ['ab', 'cd'] }
    const core = new GameCore(ctx)
    core.dispatch(insertEvent(1, 0, 'a'))
    const running = core.state

    expect(settle(ctx, running, asMs(0))).toBe(running)
    expect(settle(ctx, running, asMs(9_999))).toBe(running)

    const finished = settle(ctx, running, asMs(10_000))
    expect(finished).not.toBe(running)
    expect(finished.phase).toBe('finished')
    expect(finished.finishedAt).toBe(10_000)

    // Idle and already-finished states are returned untouched as well.
    const idle = new GameCore(ctx).state
    expect(settle(ctx, idle, asMs(999_999))).toBe(idle)
    expect(settle(ctx, finished, asMs(999_999))).toBe(finished)
  })
})

describe('a rejected event still publishes the run it completed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  it('insert past the deadline finishes the run', () => {
    const { store, worker } = armedPastDeadline('dl-insert', ['ab', 'cd'])

    store.insert('b')

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
    // The publication carries the timer down with it, exactly like a tick would.
    expect(worker.sent.at(-1)).toEqual({ cmd: 'stop' })
    // ...and the rejected event is still absent from the log, seq still contiguous.
    expect(store.getReplayData()?.log.map((event) => event.seq)).toEqual([1])
  })

  it('replace past the deadline finishes the run', () => {
    const { store } = armedPastDeadline('dl-replace', ['ab', 'cd'])

    store.replace(0, 1, 'x', 'ime')

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
    expect(store.getReplayData()?.log.map((event) => event.seq)).toEqual([1])
  })

  it('deleteBackward past the deadline finishes the run', () => {
    const { store } = armedPastDeadline('dl-delete', ['ab', 'cd'])

    store.deleteBackward('char')

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
    expect(store.getReplayData()?.log.map((event) => event.seq)).toEqual([1])
  })

  it('commit past the deadline finishes the run', () => {
    const { store } = armedPastDeadline('dl-commit', ['ab', 'cd'])

    store.commit()

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
    expect(store.getReplayData()?.log.map((event) => event.seq)).toEqual([1])
  })

  // The publication is what every phase-gated view hangs off (`TestResults` is
  // `v-else-if="isFinished"`), so a NEW state object has to reach `snapshot` —
  // and the run has to measure to its DEADLINE, not to the late keystroke's `t`.
  it('publishes a new snapshot object measured to the deadline', () => {
    const { store } = armedPastDeadline('dl-metrics', ['ab', 'cd'])
    const stale = store.snapshot

    store.insert('b')

    expect(store.snapshot).not.toBe(stale)
    expect(store.metrics.durationSec).toBe(10)
  })

  // The fifth dispatching site. A v2 telemetry key is a state NO-OP in the
  // reducer — but `dispatch` settles the clock before it reduces regardless, so
  // the keyup of the very key that typed the last grapheme can finish the run.
  // It is the LAST event a finished run will ever see (the guard below drops
  // telemetry once the core is finished), so dropping this publication strands
  // the screen until some other key arrives.
  it('a v2 telemetry key past the deadline finishes the run', () => {
    const store = useGameStore('dl-telemetry')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'], logVersion: 2 })
    setClock(5_000)
    store.keyDown('KeyA')
    store.insert('a')
    expect(store.phase).toBe('running')

    setClock(5_000 + 10_001)
    store.keyUp('KeyA') // the release of the key that typed the final grapheme

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
    expect(worker.sent.at(-1)).toEqual({ cmd: 'stop' })
  })

  // The capture gate ("a finished run records no more keys") must never double
  // as a publication gate. If the core is finished while `snapshot` still says
  // running — however that happened — returning at the gate would lock the
  // desync in forever, because no later telemetry gets past it either. The
  // reconcile therefore runs BEFORE the gate, which makes every dispatch entry
  // point in the store self-healing. `setState` injects the desync here; the
  // repair must not depend on where it came from.
  it('telemetry repairs a desync instead of being locked out by its own gate', () => {
    const store = useGameStore('dl-desync')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'], logVersion: 2 })
    setClock(1_000)
    store.insert('a')
    const stale = store.snapshot // a running state
    worker.emitTick(10_000)
    expect(store.phase).toBe('finished')

    store.setState(stale) // core: finished. snapshot: running.
    expect(store.phase).toBe('running')

    setClock(12_000)
    store.keyUp('KeyA')

    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
  })

  // ONE physical key produces a keydown, an insert and a keyup. Past the
  // deadline the keydown now publishes `finished` before the insert of the same
  // key is even dispatched, so everything downstream sees the transition once:
  // one `stop`, one snapshot write, one rising edge for the page watchers.
  it('one physical key past the deadline publishes exactly once', async () => {
    const store = useGameStore('dl-one-key')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'], logVersion: 2 })
    setClock(1_000)
    store.keyDown('KeyA')
    store.insert('a')
    store.keyUp('KeyA')
    expect(store.phase).toBe('running')

    // Every write to `snapshot`, not every change of `phase`: a second
    // publication would be invisible to a phase watcher but is exactly what
    // this has to rule out.
    let writes = 0
    const phases: string[] = []
    const risingEdges: string[] = []
    const scope = effectScope()
    scope.run(() => {
      watch(
        () => store.snapshot,
        () => {
          writes += 1
        },
        { flush: 'sync' }
      )
      // The page's own two watchers, in their real (default) flush.
      watch(
        () => store.phase,
        (phase) => {
          phases.push(phase)
        }
      )
      // `finishedOk` in home/ui.vue, and `useRunSubmission`'s rising-edge guard.
      const finishedOk = computed(
        () => store.phase === 'finished' && store.snapshot.failReason === null
      )
      watch(finishedOk, (now, previous) => {
        if (now && !previous) risingEdges.push('submit')
      })
    })

    // The deadline passes with no tick, then one whole physical key lands.
    setClock(1_000 + 10_400)
    store.keyDown('KeyB') // publishes the completion
    store.insert('b') // rejected: TestFinished
    store.keyUp('KeyB') // dropped by the capture gate
    await nextTick()

    expect(store.phase).toBe('finished')
    expect(writes).toBe(1)
    expect(phases).toEqual(['finished'])
    expect(risingEdges).toEqual(['submit'])
    // A deadline finish is not a failure, so home's `bumpRestarts()` branch —
    // gated on `failReason !== null` — is not on this path at all.
    expect(store.snapshot.failReason).toBeNull()
    // One stop, not two: the second publication never happens.
    expect(worker.sent.filter((command) => command.cmd === 'stop')).toHaveLength(1)
    // The keydown that revealed the deadline is logged (telemetry is exempt
    // from the deadline rule); the insert of that same key is not.
    const log = store.getReplayData()?.log ?? []
    expect(log.map((event) => event.kind)).toEqual(['down', 'insert', 'up', 'down'])
    expect(log.map((event) => event.seq)).toEqual([1, 2, 3, 4])
    expect(store.snapshot.finishedAt).toBe(10_000)

    scope.stop()
  })

  // A rejection that is NOT a completion must stay silent: nothing changed in the
  // core, so nothing is republished and no timer command is sent.
  it('leaves an ordinary rejection alone', () => {
    const store = useGameStore('dl-plain')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: { ...timeConfig, durationMs: 60_000 }, words: ['ab', 'cd'] })
    setClock(0)
    store.insert('a')
    store.insert('b')
    store.commit()
    const before = store.snapshot
    const sentBefore = worker.sent.length

    store.deleteBackward('char') // BackspaceLocked — the previous word is correct

    expect(store.snapshot).toBe(before)
    expect(worker.sent).toHaveLength(sentBefore)
    expect(store.phase).toBe('running')
  })
})
