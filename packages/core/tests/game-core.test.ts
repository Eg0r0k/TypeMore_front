import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  type GameState,
  DEFAULT_MAX_EXTRA_CHARS,
  GameCore,
  MINSPEED_GRACE_MS,
  asMs,
  commitEvent,
  computeMetrics,
  deleteEvent,
  foldLog,
  initialState,
  initialStateOf,
  insertEvent,
  progressOf,
  reduce,
  replaceEvent,
  targetCharsOf
} from '@typemore/core'

const config = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const ctxOf = (words: string[], over: Partial<CoreConfig> = {}): CoreContext => ({
  config: config(over),
  words
})

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

describe('replay determinism', () => {
  const words = ['hello', 'world', 'foo']
  const ctx = ctxOf(words)
  const log: GameEvent[] = [
    insertEvent(1, 0, 'h'),
    insertEvent(2, 90, 'e'),
    insertEvent(3, 180, 'l'),
    insertEvent(4, 260, 'l'),
    insertEvent(5, 340, 'o'),
    commitEvent(6, 420),
    insertEvent(7, 500, 'w'),
    insertEvent(8, 560, 'o'),
    insertEvent(9, 640, 'r'),
    insertEvent(10, 700, 'l'),
    insertEvent(11, 760, 'd'),
    commitEvent(12, 820),
    insertEvent(13, 900, 'f'),
    insertEvent(14, 980, 'o'),
    insertEvent(15, 1060, 'o'),
    commitEvent(16, 1120)
  ]

  it('produces a bit-identical final state twice', () => {
    const a = foldLog(ctx, log)._unsafeUnwrap()
    const b = foldLog(ctx, log)._unsafeUnwrap()
    expect(a).toEqual(b)
    expect(a.phase).toBe('finished')
  })

  it('produces bit-identical metrics twice', () => {
    const end = foldLog(ctx, log)._unsafeUnwrap().finishedAt
    expect(end).not.toBeNull()
    const m1 = computeMetrics(ctx, log, end ?? asMs(0))
    const m2 = computeMetrics(ctx, log, end ?? asMs(0))
    expect(m1).toEqual(m2)
    expect(m1.accuracy).toBe(1)
    expect(m1.wpm).toBeGreaterThan(0)
  })

  it('GameCore incremental dispatch matches batch foldLog', () => {
    const core = new GameCore({ config: ctx.config, words })
    for (const event of log) core.dispatch(event)
    expect(core.state).toEqual(foldLog(ctx, log)._unsafeUnwrap())
  })
})

describe('reduce edge cases', () => {
  it('backspace into a correctly-committed word is rejected (locked)', () => {
    const ctx = ctxOf(['ab', 'cd'])
    // Build up to: word 0 committed correct, word 1 buffer emptied.
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 50, 'b'),
      commitEvent(3, 100),
      insertEvent(4, 150, 'c'),
      deleteEvent(5, 200, 'char') // 'c' -> ''
    ])._unsafeUnwrap()
    expect(state.wordIndex).toBe(1)
    // The boundary backspace into the correct word 0 is refused.
    const blocked = reduce(ctx, state, deleteEvent(6, 250, 'char'))
    expect(blocked.isErr()).toBe(true)
    expect(blocked._unsafeUnwrapErr().kind).toBe('BackspaceLocked')
    // A whole rejected log does not fold.
    expect(
      foldLog(ctx, [
        insertEvent(1, 0, 'a'),
        insertEvent(2, 50, 'b'),
        commitEvent(3, 100),
        insertEvent(4, 150, 'c'),
        deleteEvent(5, 200, 'char'),
        deleteEvent(6, 250, 'char')
      ]).isErr()
    ).toBe(true)
  })

  it('backspace into an errored previous word crosses the boundary', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 50, 'x'), // typo -> word 0 errored ('ax' !== 'ab')
      commitEvent(3, 100),
      insertEvent(4, 150, 'c'),
      deleteEvent(5, 200, 'char'), // 'c' -> ''
      deleteEvent(6, 250, 'char') // empty buffer, prev word errored -> step back
    ])._unsafeUnwrap()
    expect(state.wordIndex).toBe(0)
    expect(state.input[0]).toBe('ax')
  })

  it('a rejected locked backspace leaves the source state untouched', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const running = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 50, 'b'),
      commitEvent(3, 100)
    ])._unsafeUnwrap()
    const before = JSON.stringify(running)
    const result = reduce(ctx, running, deleteEvent(4, 150, 'char'))
    expect(result.isErr()).toBe(true)
    expect(JSON.stringify(running)).toBe(before)
  })

  it('ctrl+backspace is locked at a correct word, allowed at an errored one', () => {
    const correctCtx = ctxOf(['ab', 'cd'])
    const atCorrect = foldLog(correctCtx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 50, 'b'),
      commitEvent(3, 100)
    ])._unsafeUnwrap()
    expect(reduce(correctCtx, atCorrect, deleteEvent(4, 150, 'word')).isErr()).toBe(true)

    const crossed = foldLog(ctxOf(['ab', 'cd']), [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 50, 'x'),
      commitEvent(3, 100),
      deleteEvent(4, 150, 'word') // empty word 1, prev errored -> step back + clear
    ])._unsafeUnwrap()
    expect(crossed.wordIndex).toBe(0)
    expect(crossed.input[0]).toBe('')
  })

  it('counts typos and extra characters', () => {
    const ctx = ctxOf(['cat'])
    const metrics = computeMetrics(
      ctx,
      [
        insertEvent(1, 0, 'c'),
        insertEvent(2, 50, 'x'), // typo at position 1
        insertEvent(3, 100, 't'),
        insertEvent(4, 150, 's'), // extra
        insertEvent(5, 200, 's') // extra
      ],
      asMs(200)
    )
    expect(metrics.chars.correct).toBe(2)
    expect(metrics.chars.incorrect).toBe(1)
    expect(metrics.chars.extra).toBe(2)
    expect(metrics.accuracy).toBeCloseTo(2 / 5)
  })

  it('commit of an empty word does not start or advance', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const idle = reduce(ctx, initialState(), commitEvent(1, 0))._unsafeUnwrap()
    expect(idle.phase).toBe('idle')
    expect(idle.wordIndex).toBe(0)

    const running = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      deleteEvent(2, 50, 'char'), // buffer empty again
      commitEvent(3, 100)
    ])._unsafeUnwrap()
    expect(running.phase).toBe('running')
    expect(running.wordIndex).toBe(0)
  })

  it('orders same-t events by seq', () => {
    const ctx = ctxOf(['ab'])
    const shuffled = [insertEvent(2, 5, 'b'), insertEvent(1, 5, 'a')]
    expect(foldLog(ctx, shuffled)._unsafeUnwrap().input[0]).toBe('ab')
  })

  it('rejects non-monotonic / duplicate seq', () => {
    const ctx = ctxOf(['ab'])
    const first = reduce(ctx, initialState(), insertEvent(5, 0, 'a'))._unsafeUnwrap()
    const dup = reduce(ctx, first, insertEvent(5, 10, 'b'))
    expect(dup.isErr()).toBe(true)
    expect(dup._unsafeUnwrapErr().kind).toBe('NonMonotonicSeq')
  })

  it('rejects inserts past the extra-character cap', () => {
    const ctx = ctxOf(['ab'], { maxExtraChars: 2 })
    let state = initialState()
    for (const event of [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 1, 'b'),
      insertEvent(3, 2, 'x'),
      insertEvent(4, 3, 'y')
    ]) {
      const result = reduce(ctx, state, event)
      if (result.isOk()) state = result.value
    }
    expect(state.input[0]).toBe('abxy') // 'ab' + 2 allowed extras
    const over = reduce(ctx, state, insertEvent(5, 4, 'z'))
    expect(over._unsafeUnwrapErr().kind).toBe('WordLengthExceeded')
  })

  it('applies a ranged replace (IME/paste) into the buffer', () => {
    const ctx = ctxOf(['hello'])
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'h'),
      insertEvent(2, 50, 'x'),
      replaceEvent(3, 100, 1, 2, 'e', 'ime')
    ])._unsafeUnwrap()
    expect(state.input[0]).toBe('he')
  })
})

describe('timed completion', () => {
  it('finishes at the deadline via settle without any further input', () => {
    const ctx = ctxOf(['a', 'b', 'c'], { mode: 'time', durationMs: 15_000 })
    const state = foldLog(ctx, [insertEvent(1, 0, 'a')], asMs(15_000))._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.finishedAt).toBe(15_000)
  })

  it('pins duration to the configured time, not the tick instant', () => {
    const ctx = ctxOf(['a', 'b', 'c'], { mode: 'time', durationMs: 10_000 })
    const core = new GameCore({ config: ctx.config, words: ['a', 'b', 'c'] })
    core.dispatch(insertEvent(1, 0, 'a'))
    // Tick fires late (frozen tab caught up): 12s wall-clock.
    core.tick(asMs(12_000))
    expect(core.state.phase).toBe('finished')
    expect(core.state.finishedAt).toBe(10_000)
  })
})

describe('purity: reduce does not mutate its input state', () => {
  it('leaves the source state untouched and returns a new object', () => {
    const ctx = ctxOf(['hello'])
    const events: GameEvent[] = [
      insertEvent(1, 0, 'h'),
      deleteEvent(2, 10, 'char'),
      insertEvent(3, 20, 'x'),
      commitEvent(4, 30),
      deleteEvent(5, 40, 'word')
    ]
    let state: GameState = initialState()
    for (const event of events) {
      const frozen = deepFreeze(structuredClone(state))
      const snapshot = JSON.stringify(frozen)
      const result = reduce(ctx, frozen, event)
      expect(JSON.stringify(frozen)).toBe(snapshot)
      if (result.isOk()) {
        expect(result.value).not.toBe(frozen)
        state = result.value
      }
    }
  })
})

describe('unknown event kinds (foreign input is total, never a throw)', () => {
  const words = ['ab', 'cd']
  // A kind from a hypothetical newer client. Brands are compile-time only, so a
  // relayed payload really can carry this shape at runtime.
  const unknownEvent = (seq: number, t: number): GameEvent =>
    ({ kind: 'teleport', seq, t }) as unknown as GameEvent

  it('foldLog rejects with UnknownEventKind at the offending seq', () => {
    const ctx = ctxOf(words)
    const fail = foldLog(ctx, [insertEvent(1, 0, 'a'), unknownEvent(2, 50)])._unsafeUnwrapErr()
    expect(fail.error.kind).toBe('UnknownEventKind')
    expect(fail.at).toBe(2)
  })

  it('foldLog aborts at the first unknown kind; later valid events are never applied (first-error contract)', () => {
    const ctx = ctxOf(words)
    const fail = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      unknownEvent(2, 50),
      insertEvent(3, 100, 'b'),
      commitEvent(4, 150)
    ])._unsafeUnwrapErr()
    expect(fail.error.kind).toBe('UnknownEventKind')
    expect(fail.at).toBe(2)
  })

  it('dispatch rejects, leaves state exactly as settled, and logs nothing', () => {
    const core = new GameCore({ config: config(), words })
    core.dispatch(insertEvent(1, 0, 'a'))
    const before = core.state
    const result = core.dispatch(unknownEvent(2, 50))
    expect(result._unsafeUnwrapErr().kind).toBe('UnknownEventKind')
    // words mode: settle is a no-op, so "as settled" means the exact same state object.
    expect(core.state).toBe(before)
    expect(core.events).toHaveLength(1)
  })

  it('dispatch parity with other rejected events: deadline settlement still applies', () => {
    const core = new GameCore({ config: config({ mode: 'time', durationMs: 10_000 }), words })
    core.dispatch(insertEvent(1, 0, 'a'))
    // Arrives past the deadline: settle finishes the run first (so the rejection
    // is TestFinished here), and the settled state is kept — same semantics as
    // every other rejected event.
    const result = core.dispatch(unknownEvent(2, 12_000))
    expect(result.isErr()).toBe(true)
    expect(core.state.phase).toBe('finished')
    expect(core.state.finishedAt).toBe(10_000)
    expect(core.events).toHaveLength(1)
  })
})

describe('start policy', () => {
  it('omitted startPolicy keeps the lazy start: the initial state is idle and an empty log never runs', () => {
    const ctx = ctxOf(['ab', 'cd'])
    expect(initialStateOf(ctx)).toEqual(initialState())
    const empty = foldLog(ctx, [])._unsafeUnwrap()
    expect(empty.phase).toBe('idle')
    expect(empty.startedAt).toBeNull()
  })

  it('omitted startPolicy anchors the run at the first event, not at t = 0', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const state = foldLog(ctx, [insertEvent(1, 250, 'a')])._unsafeUnwrap()
    expect(state.phase).toBe('running')
    expect(state.startedAt).toBe(250)
  })

  it("startPolicy 'go' finishes a timed run at the deadline from an empty log", () => {
    const ctx = ctxOf(['a', 'b', 'c'], { mode: 'time', durationMs: 10_000, startPolicy: 'go' })
    const state = foldLog(ctx, [], asMs(10_000))._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.finishedAt).toBe(10_000)
    expect(state.failReason).toBeNull()
  })

  it("startPolicy 'go' makes a fresh core running at t = 0, and a tick alone finishes it", () => {
    const words = ['a', 'b', 'c']
    const core = new GameCore({
      config: config({ mode: 'time', durationMs: 10_000, startPolicy: 'go' }),
      words
    })
    expect(core.state.phase).toBe('running')
    expect(core.state.startedAt).toBe(0)
    core.tick(asMs(10_000))
    expect(core.state.phase).toBe('finished')
    expect(core.state.finishedAt).toBe(10_000)
    expect(core.events).toHaveLength(0)
  })

  it("startPolicy 'go' measures the MinSpeed floor from GO: an idle run fails at the grace instant", () => {
    const ctx = ctxOf(['ab', 'cd'], { minWpm: 60, startPolicy: 'go' })
    // No keystroke ever happens, so 0 net chars clamp the breach to the grace window.
    expect(foldLog(ctx, [], asMs(MINSPEED_GRACE_MS - 1))._unsafeUnwrap().phase).toBe('running')
    const failed = foldLog(ctx, [], asMs(MINSPEED_GRACE_MS))._unsafeUnwrap()
    expect(failed.phase).toBe('finished')
    expect(failed.finishedAt).toBe(MINSPEED_GRACE_MS)
    expect(failed.failReason).toBe('minSpeed')
  })

  it("startPolicy 'go' gives a late starter no extra time (first event at 5s still finishes at 10s)", () => {
    const ctx = ctxOf(['a', 'b', 'c'], { mode: 'time', durationMs: 10_000, startPolicy: 'go' })
    const state = foldLog(ctx, [insertEvent(1, 5000, 'a')], asMs(10_000))._unsafeUnwrap()
    expect(state.startedAt).toBe(0)
    expect(state.finishedAt).toBe(10_000)
    // The same log under the lazy default would run until 15_000 — that is the bug this pins.
    const lazy = foldLog(
      ctxOf(['a', 'b', 'c'], { mode: 'time', durationMs: 10_000 }),
      [insertEvent(1, 5000, 'a')],
      asMs(15_000)
    )._unsafeUnwrap()
    expect(lazy.finishedAt).toBe(15_000)
  })
})

// Deterministic LCG: a property sweep must replay identically in CI.
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('canonical progress', () => {
  it('extra characters never advance progress', () => {
    const ctx = ctxOf(['abc', 'def'])
    const exact = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b'),
      insertEvent(3, 20, 'c')
    ])._unsafeUnwrap()
    const overTyped = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b'),
      insertEvent(3, 20, 'c'),
      insertEvent(4, 30, 'xxxxx') // 5 extras, well inside maxExtraChars
    ])._unsafeUnwrap()
    expect(overTyped.input[0]).toBe('abcxxxxx')
    expect(targetCharsOf(ctx, overTyped)).toBe(targetCharsOf(ctx, exact))
    expect(targetCharsOf(ctx, overTyped)).toBe(3)
    expect(progressOf(ctx, overTyped)).toBe(progressOf(ctx, exact))
    expect(progressOf(ctx, overTyped)).toBeCloseTo(0.5, 10)
  })

  it('a committed word contributes its full target length even when letters were skipped', () => {
    const ctx = ctxOf(['abc', 'de'])
    const skipped = foldLog(ctx, [insertEvent(1, 0, 'a'), commitEvent(2, 10)])._unsafeUnwrap()
    expect(skipped.wordIndex).toBe(1)
    expect(targetCharsOf(ctx, skipped)).toBe(3)
  })

  it('progress is exactly 1 once every word of a words-mode run is committed', () => {
    const ctx = ctxOf(['abc', 'de'])
    const done = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b'),
      insertEvent(3, 20, 'c'),
      commitEvent(4, 30),
      insertEvent(5, 40, 'd'),
      insertEvent(6, 50, 'e'),
      commitEvent(7, 60)
    ])._unsafeUnwrap()
    expect(done.phase).toBe('finished')
    expect(progressOf(ctx, done)).toBe(1)
  })

  it('a timed run that ends without input reads 0 — finishing is not progress', () => {
    const ctx = ctxOf(['abc', 'de'], { mode: 'time', durationMs: 10_000, startPolicy: 'go' })
    const state = foldLog(ctx, [], asMs(10_000))._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(progressOf(ctx, state)).toBe(0)
  })

  it('progress never leaves [0, 1] for any insert / delete / commit sequence', () => {
    const words = ['alpha', 'beta', 'gamma', 'delta']
    const ctx = ctxOf(words)
    const rand = lcg(20_240_724)
    let highest = 0
    const applied = { insert: 0, delete: 0, commit: 0 }
    for (let attempt = 0; attempt < 50; attempt++) {
      let state = initialState()
      let seq = 0
      let t = 0
      for (let step = 0; step < 60; step++) {
        seq += 1
        t += 20
        const roll = rand()
        const target = words[Math.min(state.wordIndex, words.length - 1)]
        const typed = (state.input[state.wordIndex] ?? '').length
        const char = rand() < 0.75 ? (target[typed] ?? 'q') : 'q'
        const event =
          roll < 0.55
            ? insertEvent(seq, t, char)
            : roll < 0.8
              ? deleteEvent(seq, t, rand() < 0.8 ? 'char' : 'word')
              : commitEvent(seq, t)
        const result = reduce(ctx, state, event)
        if (result.isErr()) continue // rejected events leave the state exactly as it was
        applied[event.kind] += 1
        state = result.value
        const progress = progressOf(ctx, state)
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(1)
        if (progress > highest) highest = progress
      }
    }
    // Guards the sweep against vacuity: all three kinds really were applied and
    // the sweep typed its way well into the text.
    expect(applied.insert).toBeGreaterThan(0)
    expect(applied.delete).toBeGreaterThan(0)
    expect(applied.commit).toBeGreaterThan(0)
    expect(highest).toBeGreaterThan(0.5)
  })

  it('progress never decreases across a typing-only sequence (inserts and commits, no deletes)', () => {
    const words = ['alpha', 'beta', 'gamma', 'delta']
    const ctx = ctxOf(words)
    const rand = lcg(7)
    let state = initialState()
    let previous = 0
    let seq = 0
    let t = 0
    while (state.phase !== 'finished' && seq < 200) {
      seq += 1
      t += 20
      const target = words[Math.min(state.wordIndex, words.length - 1)]
      const typed = (state.input[state.wordIndex] ?? '').length
      const roll = rand()
      // 20% commits land mid-word too, so skipped letters are part of the sweep.
      const event =
        roll < 0.8
          ? insertEvent(seq, t, rand() < 0.8 ? (target[typed] ?? 'q') : 'q')
          : commitEvent(seq, t)
      const result = reduce(ctx, state, event)
      if (result.isErr()) continue
      state = result.value
      const progress = progressOf(ctx, state)
      expect(progress).toBeGreaterThanOrEqual(previous)
      previous = progress
    }
    expect(state.phase).toBe('finished')
    expect(previous).toBe(1)
  })
})
