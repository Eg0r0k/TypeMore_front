import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type ModsDeclaration,
  type TimerCommand,
  type TimerTick,
  DEFAULT_MAX_EXTRA_CHARS
} from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { plannedMultiplier, releaseGameStore, toCoreSetup, useGameStore } from '@entities/game'

const wordsConfig: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false
}

describe('game store factory', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // Contract for up to 5 players: each store owns its own GameCore; no shared state.
  it('keeps two instances fully isolated', () => {
    const a = useGameStore('p1')
    const b = useGameStore('p2')
    a.setup({ config: wordsConfig, words: ['ab', 'cd'] })
    b.setup({ config: wordsConfig, words: ['ab', 'cd'] })

    a.insert('a')
    a.insert('b')
    a.commit()

    expect(a.phase).toBe('running')
    expect(a.wordIndex).toBe(1)

    // B was never touched.
    expect(b.phase).toBe('idle')
    expect(b.wordIndex).toBe(0)
    expect(b.snapshot.input).toEqual([])
  })

  it('returns the same store per id and distinct stores per id', () => {
    const first = useGameStore('p1')
    const again = useGameStore('p1')
    const other = useGameStore('p2')
    expect(first).toBe(again)
    expect(first.$id).toBe('game:p1')
    expect(other.$id).toBe('game:p2')
  })

  it('computes metrics per instance from its own log', () => {
    const a = useGameStore('p1')
    const b = useGameStore('p2')
    a.setup({ config: wordsConfig, words: ['hi'] })
    b.setup({ config: wordsConfig, words: ['hi'] })

    a.insert('h')
    a.insert('i')
    a.commit() // single word committed -> finished

    expect(a.phase).toBe('finished')
    expect(a.metrics.accuracy).toBe(1)
    expect(a.metrics.chars.correct).toBe(2)

    expect(b.phase).toBe('idle')
    expect(b.metrics.accuracy).toBe(0)
  })

  it('backspace does not cross into a correctly-committed word (reducer rule)', () => {
    const store = useGameStore('p1')
    store.setup({ config: wordsConfig, words: ['ab', 'cd'] })
    store.insert('a')
    store.insert('b')
    store.commit()
    store.insert('c')
    store.deleteBackward('char') // 'c' -> ''
    store.deleteBackward('char') // prev word correct -> no-op (locked)

    expect(store.wordIndex).toBe(1)
    expect(store.snapshot.input[0]).toBe('ab')
  })

  // Wire/validation invariant: validateLog rule #1 demands seq == index + 1,
  // and match peers freeze a ghost on any seq gap — so a REJECTED event must
  // hand its seq back instead of punching a hole in the accepted log.
  it('rejected events do not consume seq — the accepted log stays contiguous', () => {
    const store = useGameStore('p1')
    store.setup({ config: wordsConfig, words: ['ab', 'cd'] })
    store.insert('a')
    store.insert('b')
    store.commit()
    store.deleteBackward('char') // prev word correct -> BackspaceLocked, rejected
    store.insert('c')

    const log = store.getReplayData()!.log
    expect(log.map((event) => event.seq)).toEqual([1, 2, 3, 4])
    expect(log[3]).toMatchObject({ kind: 'insert', text: 'c' })
  })
})

describe('reconfiguration', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // Changing a setting = a brand-new immutable instance (restart), never a mutation.
  it('setup with a new config replaces the instance with a fresh idle state', () => {
    const store = useGameStore('p1')
    store.setup({ config: wordsConfig, words: ['ab', 'cd'] })
    store.insert('a')
    expect(store.phase).toBe('running')

    store.setup({
      config: {
        mode: 'time',
        durationMs: 30_000,
        maxExtraChars: 20,
        difficulty: 'normal',
        nospace: false
      },
      words: ['xx', 'yy', 'zz']
    })
    expect(store.phase).toBe('idle')
    expect(store.wordIndex).toBe(0)
    expect(store.snapshot.input).toEqual([])
    expect(store.words).toEqual(['xx', 'yy', 'zz'])
  })
})

describe('declared view mods', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const declaration = (over: Partial<ModsDeclaration> = {}): ModsDeclaration => ({
    blind: false,
    fading: false,
    flashlight: false,
    ...over
  })

  // The bug this guards: flashlight ON at setup, toggled OFF before typing — the
  // multiplier kept the ×1.4 of a mod that is no longer active.
  it('re-declaring while idle moves the multiplier and the breakdown', () => {
    const store = useGameStore('mods-idle')
    store.setup({
      config: wordsConfig,
      words: ['ab', 'cd'],
      declaration: declaration({ flashlight: true })
    })
    expect(store.modMultiplier).toBeCloseTo(1.4, 10)

    store.setDeclaration(declaration())
    expect(store.modMultiplier).toBe(1)
    expect(store.activeMods).toEqual([])

    store.setDeclaration(declaration({ blind: true }))
    expect(store.modMultiplier).toBeCloseTo(1.3, 10)
    expect(store.activeMods).toEqual([{ id: 'blind', multiplier: 1.3 }])

    releaseGameStore('mods-idle')
  })

  // A run is scored under the mods it was played with: once the first keystroke
  // lands, the declaration is frozen for the score, the chips and the replay.
  it('ignores a re-declaration once the run has started', () => {
    const store = useGameStore('mods-running')
    store.setup({
      config: wordsConfig,
      words: ['ab', 'cd'],
      declaration: declaration({ flashlight: true })
    })
    store.insert('a')
    expect(store.phase).toBe('running')

    store.setDeclaration(declaration())
    expect(store.modMultiplier).toBeCloseTo(1.4, 10)
    expect(store.getReplayData()?.declaration).toEqual(declaration({ flashlight: true }))

    releaseGameStore('mods-running')
  })
})

describe('toCoreSetup', () => {
  it('maps timed mode: duration in ms, generation length in seconds', () => {
    const { coreConfig, generation } = toCoreSetup({
      mode: 'time',
      time: 15,
      words: 50,
      punctuation: false,
      numbers: false,
      randomCase: false,
      nospace: false,
      difficulty: 'normal'
    })
    expect(coreConfig).toEqual({
      mode: 'time',
      durationMs: 15_000,
      maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
      difficulty: 'normal',
      nospace: false
    })
    expect(generation).toEqual({
      mode: 'time',
      length: 15,
      punctuation: false,
      numbers: false,
      randomCase: false
    })
  })

  it('maps word-count mode: generation length in words', () => {
    const { coreConfig, generation } = toCoreSetup({
      mode: 'words',
      time: 15,
      words: 50,
      punctuation: true,
      numbers: false,
      randomCase: true,
      nospace: true,
      difficulty: 'expert'
    })
    expect(coreConfig.durationMs).toBe(15_000)
    expect(coreConfig.difficulty).toBe('expert')
    expect(coreConfig.nospace).toBe(true)
    expect(generation.mode).toBe('words')
    expect(generation.length).toBe(50)
    expect(generation.punctuation).toBe(true)
    expect(generation.randomCase).toBe(true)
  })

  it('threads lazy mode and its language key into the seed context', () => {
    const { generation } = toCoreSetup({
      mode: 'words',
      time: 15,
      words: 50,
      punctuation: false,
      numbers: false,
      randomCase: false,
      nospace: false,
      difficulty: 'normal',
      lazy: true,
      language: 'german_1k'
    })
    // Both fields travel in the generation config, never the reducer snapshot:
    // lazy rewrites the TARGETS, and nothing about input handling sees it.
    expect(generation.lazy).toBe(true)
    expect(generation.language).toBe('german_1k')
  })

  it('pays no multiplier for lazy mode — it makes a run easier, not harder', () => {
    const settings = {
      mode: 'words',
      time: 15,
      words: 50,
      punctuation: false,
      numbers: false,
      randomCase: false,
      nospace: false,
      difficulty: 'normal'
    } as const
    const declaration = { blind: false, fading: false, flashlight: false }
    expect(plannedMultiplier({ ...settings, lazy: true }, declaration)).toBe(
      plannedMultiplier(settings, declaration)
    )
  })
})

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
    // Only `data` is read by the handler; a full MessageEvent is unnecessary.
    this.onmessage?.({ data: { type: 'tick', elapsedMs } } as unknown as MessageEvent<TimerTick>)
  }
}

const timeConfig: CoreConfig = {
  mode: 'time',
  durationMs: 10_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false
}

describe('timer lifecycle (store owns the worker)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('two stores drive two live workers that tick independently', () => {
    const a = useGameStore('lt1a')
    const b = useGameStore('lt1b')
    const workerA = new FakeTimerWorker()
    const workerB = new FakeTimerWorker()
    a.attachTimer(() => workerA)
    b.attachTimer(() => workerB)
    a.setup({ config: timeConfig, words: ['aa', 'bb'] })
    b.setup({ config: timeConfig, words: ['aa', 'bb'] })

    a.insert('a')
    b.insert('a')
    expect(workerA.sent).toContainEqual({ cmd: 'start', durationMs: 10_000 })
    expect(workerB.sent).toContainEqual({ cmd: 'start', durationMs: 10_000 })

    workerA.emitTick(12_000) // past A's deadline; B's worker never ticks
    expect(a.phase).toBe('finished')
    expect(b.phase).toBe('running')
  })

  it('attach → detach → attach works on the same store', () => {
    const store = useGameStore('lt2')
    const first = new FakeTimerWorker()
    store.attachTimer(() => first)
    store.detachTimer()
    expect(first.terminated).toBe(true)

    const second = new FakeTimerWorker()
    store.attachTimer(() => second) // the guard must not block after detach
    store.setup({ config: timeConfig, words: ['aa'] })
    store.insert('a')
    second.emitTick(12_000)
    expect(store.phase).toBe('finished')
    expect(second.terminated).toBe(false)
  })

  it('survives the attaching component scope being stopped (page remount scenario)', () => {
    // Regression: worker disposal used to be tied to whichever scope called
    // attachTimer. Unmounting that component killed the worker while the store's
    // attach guard blocked re-creation — a permanently dead timer on remount.
    const store = useGameStore('lt3')
    const worker = new FakeTimerWorker()
    const scope = effectScope()
    scope.run(() => store.attachTimer(() => worker))
    scope.stop() // "unmount" the page
    expect(worker.terminated).toBe(false)

    store.attachTimer(() => new FakeTimerWorker()) // "remount": idempotent no-op
    store.setup({ config: timeConfig, words: ['aa'] })
    store.insert('a')
    worker.emitTick(12_000) // the original worker still drives the core
    expect(store.phase).toBe('finished')
  })

  it('releaseGameStore terminates the worker and forgets the id', () => {
    const store = useGameStore('lt4')
    const worker = new FakeTimerWorker()
    store.attachTimer(() => worker)
    store.setup({ config: timeConfig, words: ['aa', 'bb'] })
    store.insert('a')
    expect(store.words).toHaveLength(2)

    releaseGameStore('lt4')
    expect(worker.terminated).toBe(true)

    // The id starts over: fresh definition, fresh state.
    const fresh = useGameStore('lt4')
    expect(fresh.words).toHaveLength(0)
    expect(fresh.phase).toBe('idle')
  })

  it('releaseGameStore on an unknown id is a no-op', () => {
    expect(() => releaseGameStore('never-created')).not.toThrow()
  })
})
