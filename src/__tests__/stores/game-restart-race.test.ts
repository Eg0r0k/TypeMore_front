/**
 * The restart-over-a-live-run sequence, at the seam where it can go wrong.
 *
 * `onRestart` calls the ASYNC `loadAndSetup` over a run that is still running:
 * the old core keeps its worker ticking for the whole `await` (dictionary body,
 * quote draw), `setup()` then swaps the core and posts `reset`, and the next run
 * starts on the player's first keystroke. Three things can cross that seam — a
 * tick posted before the `reset` was processed, a second overlapping
 * `loadAndSetup`, and the question of whether the new run gets a `start` at all.
 *
 * These are the D / E / F hypotheses of the hang investigation, pinned as tests
 * so the verdicts stay verdicts. The hang itself is NOT here: it is the worker
 * stopping short of the deadline (`packages/core/tests/timer-worker-deadline.test.ts`)
 * plus the store dropping the completion a rejected event carried
 * (`game-deadline-publish.test.ts`).
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoreConfig, TimerCommand, TimerTick } from '@typemore/core'
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
    this.onmessage?.({ data: { type: 'tick', elapsedMs, epoch } } as unknown as MessageEvent<TimerTick>)
  }

  starts(): TimerCommand[] {
    return this.sent.filter((command) => command.cmd === 'start')
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

describe('D — does the new run always get its timer started?', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  // `applyResult` starts the timer on `wasIdle && phase === 'running'`, and only
  // `insert`/`replace` are wired to pass `wasIdle`. That is sound only because
  // the reducer cannot leave `idle` any other way: `reduceDelete` and
  // `reduceCommit` both carry `state.phase` forward untouched. If either ever
  // started a run, it would start one with no timer behind it — zero ticks, and
  // a timed run that can never reach its deadline.
  it('delete and commit cannot start a run, so they cannot start one unclocked', () => {
    for (const [id, drive] of [
      ['d-del-char', (s: ReturnType<typeof useGameStore>) => s.deleteBackward('char')],
      ['d-del-word', (s: ReturnType<typeof useGameStore>) => s.deleteBackward('word')],
      ['d-commit', (s: ReturnType<typeof useGameStore>) => s.commit()]
    ] as const) {
      const store = useGameStore(id)
      const worker = new FakeTimerWorker()
      store.attachTimer(() => worker)
      store.setup({ config: timeConfig, words: ['ab', 'cd'] })

      drive(store)

      expect(store.phase).toBe('idle')
      expect(worker.starts()).toEqual([])
    }
  })

  it('insert and replace start the run and always issue exactly one start', () => {
    for (const [id, drive] of [
      ['d-insert', (s: ReturnType<typeof useGameStore>) => s.insert('a')],
      ['d-replace', (s: ReturnType<typeof useGameStore>) => s.replace(0, 0, 'a', 'ime')]
    ] as const) {
      const store = useGameStore(id)
      const worker = new FakeTimerWorker()
      store.attachTimer(() => worker)
      store.setup({ config: timeConfig, words: ['ab', 'cd'] })

      drive(store)

      expect(store.phase).toBe('running')
      expect(worker.starts()).toEqual([{ cmd: 'start', durationMs: 10_000, epoch: 1 }])
    }
  })

  // A first keystroke the reducer REFUSES (stopOnError 'letter') must leave the
  // run idle, so the keystroke that does land is still the one that starts it.
  // A rejected first key that consumed `wasIdle` would be a timerless run.
  it('a refused first keystroke leaves the start for the next one', () => {
    const store = useGameStore('d-refused')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({
      config: { ...timeConfig, stopOnError: 'letter' },
      words: ['ab', 'cd']
    })

    store.insert('z') // wrong grapheme — rejected outright
    expect(store.phase).toBe('idle')
    expect(worker.starts()).toEqual([])

    store.insert('a')
    expect(store.phase).toBe('running')
    expect(worker.starts()).toEqual([{ cmd: 'start', durationMs: 10_000, epoch: 1 }])
  })

  // The restart sequence itself: a `setup()` landing on a RUNNING run must leave
  // the store able to start the next one. (`timer` survives `setup` by design —
  // only `detachTimer` clears it, and nothing on the solo page calls that: the
  // race host explicitly borrows the 'local' store without releasing it.)
  it('a setup over a running run still starts the next run', () => {
    const store = useGameStore('d-restart')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'] })
    store.insert('a')
    worker.emitTick(3000)
    expect(store.phase).toBe('running')

    store.setup({ config: timeConfig, words: ['ef', 'gh'] }) // the restart's setup
    expect(store.phase).toBe('idle')
    expect(worker.sent.at(-1)).toEqual({ cmd: 'reset' })

    clock = 50_000
    store.insert('e')
    expect(store.phase).toBe('running')
    expect(worker.starts()).toHaveLength(2)

    // ...and it reaches its own deadline off its own ticks.
    worker.emitTick(10_000)
    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
  })
})

describe('E — a tick from the previous run crossing the restart seam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  /** Run N-1: started, ticking, and about to be restarted mid-flight. */
  function liveRun(id: string): {
    store: ReturnType<typeof useGameStore>
    worker: FakeTimerWorker
  } {
    const store = useGameStore(id)
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'] })
    store.insert('a')
    worker.emitTick(3000)
    return { store, worker }
  }

  // The ordinary ordering: the stale tick is delivered while the new core is
  // still idle (the message was queued before `reset` reached the worker). It
  // reduces to nothing — `settle` does not touch an idle state — and the first
  // keystroke re-pins the live clock anyway.
  it('a stale tick on the idle new run is inert', () => {
    const { store, worker } = liveRun('e-idle')

    store.setup({ config: timeConfig, words: ['ef', 'gh'] })
    worker.emitTick(9000) // in flight from the previous run

    expect(store.phase).toBe('idle')

    clock = 50_000
    store.insert('e')
    worker.emitTick(10_000)
    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
  })

  // The hostile ordering: the stale tick lands AFTER the new run's first
  // keystroke. Chrome prioritises user-input tasks over worker messages, so a
  // keydown queued later can run first — this is reachable, not theoretical.
  //
  // The tick handler reads the CURRENT core and the CURRENT `timerStartT`, so
  // without the epoch the previous run's elapsed is charged to this run's clock.
  // The epoch the tick carries no longer matches the one `setup` minted, so the
  // handler drops it before the core ever sees it.
  it('a stale tick after the new run started is dropped, not charged to it', () => {
    const { store, worker } = liveRun('e-live')
    const staleEpoch = worker.epoch

    store.setup({ config: timeConfig, words: ['ef', 'gh'] })
    clock = 50_000
    store.insert('e') // the new run starts, and mints its own epoch
    expect(store.phase).toBe('running')
    expect(worker.epoch).not.toBe(staleEpoch)

    worker.emitTick(9000, staleEpoch)
    worker.emitTick(10_000, staleEpoch) // would have finished it on the spot
    worker.emitTick(999_999, staleEpoch)

    expect(store.phase).toBe('running')
    expect(store.snapshot.finishedAt).toBeNull()

    // The run's OWN clock still drives it, all the way to its own deadline.
    worker.emitTick(10_000)
    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(10_000)
  })

  // The scenario that makes this worth a protocol field rather than a heuristic.
  // The settings modal opens over a LIVE run (Esc does not restart it), and
  // changing `time` fires the config watcher → `loadAndSetup` → `setup()`. A 60s
  // run restarted at its 30th second leaves a 30_000 tick in flight, which lands
  // on a fresh 15s run: past its deadline before the player's first letter, and
  // recorded as a genuine short run rather than as anything obviously broken.
  //
  // Note what does NOT close this: dropping ticks whose `elapsedMs` exceeds
  // `durationMs`. That is the symptom. A stale 10_000 tick landing on a fresh
  // 60s run is just as foreign and passes any such filter untouched.
  it('a long run restarted into a short one does not die on the old clock', () => {
    const store = useGameStore('e-duration-change')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)

    store.setup({ config: { ...timeConfig, durationMs: 60_000 }, words: ['ab', 'cd'] })
    store.insert('a')
    worker.emitTick(30_000) // 30s into the 60s run
    expect(store.phase).toBe('running')
    const staleEpoch = worker.epoch

    // The player sets `time` to 15 in the modal; the config watcher rebuilds.
    store.setup({ config: { ...timeConfig, durationMs: 15_000 }, words: ['ef', 'gh'] })
    clock = 90_000
    store.insert('e')

    worker.emitTick(30_000, staleEpoch) // in flight from the 60s run

    expect(store.phase).toBe('running')
    expect(store.getReplayData()?.log).toHaveLength(1)

    worker.emitTick(15_000) // its own deadline, its own epoch
    expect(store.phase).toBe('finished')
    expect(store.snapshot.finishedAt).toBe(15_000)
  })

  // `reset()` replaces the run just as `setup()` does, and must mint an epoch
  // for the same reason — the worker it just told to stop may already have
  // posted one more tick.
  it('reset also retires the previous clock', () => {
    const { store, worker } = liveRun('e-reset')
    const staleEpoch = worker.epoch

    store.reset()
    clock = 50_000
    store.insert('a')
    worker.emitTick(10_000, staleEpoch)

    expect(store.phase).toBe('running')
    expect(store.snapshot.finishedAt).toBeNull()
  })
})

describe('F — two overlapping loadAndSetup calls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => vi.restoreAllMocks())

  // Both calls reach `game.setup`; the store keeps exactly one core, and it is
  // the LAST setup's. The timer is reset by each, and the run that eventually
  // starts is clocked against the core that is actually on screen — the words
  // and the core cannot disagree.
  //
  // VERDICT: no timer damage at the store. The overlap's real hazard is on the
  // page (`setupState`), not here: a LOSING call that fails after the winner
  // succeeded writes an error state over a perfectly good field. That hides the
  // field; it does not strand a running run.
  it('the last setup wins and owns the timer', () => {
    const store = useGameStore('f-overlap')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)

    store.setup({ config: timeConfig, words: ['ab', 'cd'] }) // call #1 lands
    store.setup({ config: { ...timeConfig, durationMs: 30_000 }, words: ['ef', 'gh'] }) // #2

    expect(store.words).toEqual(['ef', 'gh'])
    expect(worker.sent).toEqual([{ cmd: 'reset' }, { cmd: 'reset' }])

    store.insert('e')
    expect(worker.starts()).toEqual([{ cmd: 'start', durationMs: 30_000, epoch: 2 }])
    worker.emitTick(30_000)
    expect(store.phase).toBe('finished')
  })

  // The overlap where the player types between the two setups: the run started
  // on core #1 is discarded whole, and the timer goes down with it. No orphaned
  // clock survives to tick the new core.
  it('a run started between the two setups is discarded with its clock', () => {
    const store = useGameStore('f-typed')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['ab', 'cd'] })
    store.insert('a')
    expect(store.phase).toBe('running')

    store.setup({ config: timeConfig, words: ['ef', 'gh'] })

    expect(store.phase).toBe('idle')
    expect(store.getReplayData()?.log).toEqual([]) // the old run's events are gone
    expect(store.words).toEqual(['ef', 'gh'])
    expect(worker.sent.at(-1)).toEqual({ cmd: 'reset' })
  })
})
