import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type TimerCommand,
  type TimerTick,
  foldLog,
  DEFAULT_MAX_EXTRA_CHARS
} from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { MATCH_LOCAL_STORE_ID, synthesizeBotLog, useMatchStore } from '@entities/match'
import { useGameStore } from '@entities/game'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  readonly sent: TimerCommand[] = []
  terminated = false

  /** The run this clock is armed for — echoed on every tick, like the real worker. */
  epoch = 0

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
    if (message.cmd === 'start') this.epoch = message.epoch
  }

  terminate(): void {
    this.terminated = true
  }

  emitTick(elapsedMs: number, epoch: number = this.epoch): void {
    this.onmessage?.({ data: { type: 'tick', elapsedMs, epoch } } as unknown as MessageEvent<TimerTick>)
  }
}

const words = ['ab', 'cd', 'ef']
const wordsConfig: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false
}
const timeConfig: CoreConfig = { ...wordsConfig, mode: 'time', durationMs: 10_000 }

// Feed latency must stay under the ghost display delay (jitter-buffer contract).
const FEED = { latencyMs: 40, jitterMs: 60 }

describe('match store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('createMatch builds the local store and up to 4 ghosts; extras are dropped', () => {
    const match = useMatchStore()
    const log = synthesizeBotLog(words, { wpm: 60, seed: 7 })
    match.createMatch({
      setup: { config: wordsConfig, words },
      ghosts: Array.from({ length: 6 }, (_, i) => ({ name: `bot${i}`, log }))
    })

    expect(match.active).toBe(true)
    expect(match.ghosts).toHaveLength(4)
    const local = useGameStore(MATCH_LOCAL_STORE_ID)
    expect(local.words).toHaveLength(3)
    expect(local.phase).toBe('idle')
  })

  it('advanceTo drives every feed and ghost to its foldLog-exact end state (words mode)', () => {
    const match = useMatchStore()
    const logA = synthesizeBotLog(words, { wpm: 50, seed: 1 })
    const logB = synthesizeBotLog(words, { wpm: 90, seed: 2 })
    match.createMatch({
      setup: { config: wordsConfig, words },
      ghosts: [
        { name: 'a', log: logA },
        { name: 'b', log: logB }
      ],
      feed: FEED
    })

    match.advanceTo(600_000) // far past both bots' logs + delay
    const [a, b] = match.ghosts
    expect(a.driver.view.snapshot).toEqual(
      foldLog({ config: wordsConfig, words }, logA)._unsafeUnwrap()
    )
    expect(b.driver.view.snapshot).toEqual(
      foldLog({ config: wordsConfig, words }, logB)._unsafeUnwrap()
    )
    expect(a.driver.view.finished).toBe(true)
    expect(b.driver.metrics.value.wpm).toBeGreaterThan(0)
  })

  it('tees the local timer tick into the ghost fan-out (single-timer model)', () => {
    const match = useMatchStore()
    const log = synthesizeBotLog(words, { wpm: 120, seed: 3 })
    match.createMatch({
      setup: { config: timeConfig, words },
      ghosts: [{ name: 'bot', log }],
      feed: FEED
    })

    const worker = new FakeTimerWorker()
    match.attachLocalTimer(() => worker)
    const local = useGameStore(MATCH_LOCAL_STORE_ID)

    local.insert('a') // starts the timed run -> timer.start
    expect(worker.sent).toContainEqual({ cmd: 'start', durationMs: 10_000, epoch: 1 })
    expect(match.ghosts[0].driver.view.snapshot.phase).toBe('idle')

    worker.emitTick(5_000) // one authoritative tick advances the ghost too
    expect(match.ghosts[0].driver.view.wordIndex).toBeGreaterThan(0)

    worker.emitTick(12_000) // past the local deadline: local settles, ghost drains
    expect(local.phase).toBe('finished')
    expect(match.ghosts[0].driver.view.finished).toBe(true)
  })

  // The tee is a SECOND consumer of every tick: the local store's handler drops
  // a foreign one for the core, and this side has to drop it for the ghost
  // fan-out independently. A stale tick reaching `advanceTo` would jump every
  // opponent's caret forward by a clock they never ran on — and unlike the local
  // core, nothing downstream would reject it. The epoch is read off the `start`
  // passing through the tee, so both sides agree on which run is current.
  it('does not fan a stale tick out to the ghosts', () => {
    const match = useMatchStore()
    const log = synthesizeBotLog(words, { wpm: 120, seed: 3 })
    const worker = new FakeTimerWorker()

    match.createMatch({
      setup: { config: timeConfig, words },
      ghosts: [{ name: 'bot', log }],
      feed: FEED
    })
    match.attachLocalTimer(() => worker)
    useGameStore(MATCH_LOCAL_STORE_ID).insert('a')
    worker.emitTick(5_000)
    const staleEpoch = worker.epoch
    const reached = match.ghosts[0].driver.virtualNow
    expect(reached).toBe(5_000)

    // A rematch over the same teed worker: a fresh setup mints a new epoch, and
    // the previous clock's tick is still in flight on this thread.
    match.createMatch({
      setup: { config: timeConfig, words },
      ghosts: [{ name: 'bot', log }],
      feed: FEED
    })
    useGameStore(MATCH_LOCAL_STORE_ID).insert('a')
    // NOTE the epoch REPEATS: `leaveMatch` released the local store, and its
    // fresh instance counts from zero again. That is exactly why the tee also
    // pins the match generation — the run epoch cannot tell these two apart.
    expect(worker.epoch).toBe(staleEpoch)

    worker.emitTick(9_000, staleEpoch)
    worker.emitTick(60_000, staleEpoch)

    // Never fanned out: the new match's ghost has not moved off the start line.
    expect(match.ghosts[0].driver.virtualNow).toBe(0)
    expect(match.ghosts[0].driver.view.wordIndex).toBe(0)
  })

  // The same guard on the other axis: a stale tick from a previous RUN of the
  // SAME match (the local store re-`setup`, so the epoch really does move).
  it('does not fan a previous run’s tick out to the ghosts', () => {
    const match = useMatchStore()
    const log = synthesizeBotLog(words, { wpm: 120, seed: 3 })
    const worker = new FakeTimerWorker()

    match.createMatch({
      setup: { config: timeConfig, words },
      ghosts: [{ name: 'bot', log }],
      feed: FEED
    })
    match.attachLocalTimer(() => worker)
    const local = useGameStore(MATCH_LOCAL_STORE_ID)
    local.insert('a')
    worker.emitTick(5_000)
    const staleEpoch = worker.epoch
    expect(match.ghosts[0].driver.virtualNow).toBe(5_000)

    local.setup({ config: timeConfig, words }) // the run is replaced in place
    local.insert('a')
    expect(worker.epoch).not.toBe(staleEpoch)

    worker.emitTick(60_000, staleEpoch)
    expect(match.ghosts[0].driver.virtualNow).toBe(5_000) // unmoved

    worker.emitTick(6_000) // its own clock still drives the fan-out
    expect(match.ghosts[0].driver.virtualNow).toBe(6_000)
  })

  it('leaveMatch disposes ghosts, terminates the teed worker, and releases the local id', () => {
    const match = useMatchStore()
    match.createMatch({
      setup: { config: timeConfig, words },
      ghosts: [{ name: 'bot', log: synthesizeBotLog(words, { wpm: 60, seed: 4 }) }]
    })
    const worker = new FakeTimerWorker()
    match.attachLocalTimer(() => worker)
    useGameStore(MATCH_LOCAL_STORE_ID).insert('a')

    match.leaveMatch()
    expect(match.active).toBe(false)
    expect(match.ghosts).toHaveLength(0)
    expect(worker.terminated).toBe(true)
    // The id starts fresh — released from the registry, not a stale store.
    const fresh = useGameStore(MATCH_LOCAL_STORE_ID)
    expect(fresh.phase).toBe('idle')
    expect(fresh.words).toHaveLength(0)
  })

  it('createMatch over a live match restarts cleanly (implicit leave)', () => {
    const match = useMatchStore()
    const log = synthesizeBotLog(words, { wpm: 60, seed: 5 })
    match.createMatch({ setup: { config: wordsConfig, words }, ghosts: [{ name: 'x', log }] })
    match.advanceTo(600_000)
    expect(match.ghosts[0].driver.view.finished).toBe(true)

    match.createMatch({ setup: { config: wordsConfig, words }, ghosts: [{ name: 'y', log }] })
    expect(match.ghosts[0].name).toBe('y')
    expect(match.ghosts[0].driver.view.snapshot.phase).toBe('idle')
  })
})
