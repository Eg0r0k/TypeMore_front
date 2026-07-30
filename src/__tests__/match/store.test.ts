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

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emitTick(elapsedMs: number): void {
    this.onmessage?.({ data: { type: 'tick', elapsedMs } } as unknown as MessageEvent<TimerTick>)
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
    expect(worker.sent).toContainEqual({ cmd: 'start', durationMs: 10_000 })
    expect(match.ghosts[0].driver.view.snapshot.phase).toBe('idle')

    worker.emitTick(5_000) // one authoritative tick advances the ghost too
    expect(match.ghosts[0].driver.view.wordIndex).toBeGreaterThan(0)

    worker.emitTick(12_000) // past the local deadline: local settles, ghost drains
    expect(local.phase).toBe('finished')
    expect(match.ghosts[0].driver.view.finished).toBe(true)
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
