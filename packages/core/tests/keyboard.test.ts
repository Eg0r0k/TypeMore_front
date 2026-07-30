import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  DEFAULT_MAX_EXTRA_CHARS,
  KEY_INTERVAL_CAP_MS,
  analyzeLog,
  charObservationsOf,
  commitEvent,
  deleteEvent,
  insertEvent
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

const rowOf = (rows: ReturnType<typeof charObservationsOf>, char: string) =>
  rows.find((r) => r.char === char)

describe('charObservationsOf — per-character presses, errors, intervals', () => {
  it('counts presses and freezes correctness at the landing position', () => {
    // 'ab' typed as 'ax' then corrected: the 'x' lands wrong at position 1,
    // the retyped 'b' lands right at the same position.
    const ctx = ctxOf(['ab'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'x'),
      deleteEvent(3, 200, 'char'),
      insertEvent(4, 300, 'b'),
      commitEvent(5, 400)
    ]
    const rows = charObservationsOf(ctx, log)
    expect(rowOf(rows, 'a')).toMatchObject({ presses: 1, errors: 0 })
    expect(rowOf(rows, 'x')).toMatchObject({ presses: 1, errors: 1 })
    expect(rowOf(rows, 'b')).toMatchObject({ presses: 1, errors: 0 })
    // The accepted commit is a Space press, never an error.
    expect(rowOf(rows, ' ')).toMatchObject({ presses: 1, errors: 0 })
  })

  it('attributes an interval to the key it ends on, and only inside the chain', () => {
    const ctx = ctxOf(['aba'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'), // no interval: first keystroke
      insertEvent(2, 120, 'b'), // 120 ms → 'b'
      insertEvent(3, 300, 'a') // 180 ms → 'a'
    ]
    const rows = charObservationsOf(ctx, log)
    expect(rowOf(rows, 'a')).toMatchObject({ presses: 2, intervalSumMs: 180, intervalCount: 1 })
    expect(rowOf(rows, 'b')).toMatchObject({ presses: 1, intervalSumMs: 120, intervalCount: 1 })
  })

  it('excludes pause-sized gaps and lets deletes break the chain', () => {
    const ctx = ctxOf(['abcd'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      // A gap over the cap is a pause, not typing flow.
      insertEvent(2, KEY_INTERVAL_CAP_MS + 1000, 'b'),
      insertEvent(3, KEY_INTERVAL_CAP_MS + 1100, 'x'),
      // The delete breaks the chain: 'c' gets no interval from it.
      deleteEvent(4, KEY_INTERVAL_CAP_MS + 1200, 'char'),
      insertEvent(5, KEY_INTERVAL_CAP_MS + 1400, 'c')
    ]
    const rows = charObservationsOf(ctx, log)
    expect(rowOf(rows, 'b')).toMatchObject({ intervalCount: 0 })
    expect(rowOf(rows, 'x')).toMatchObject({ intervalCount: 1, intervalSumMs: 100 })
    expect(rowOf(rows, 'c')).toMatchObject({ intervalCount: 0 })
  })

  it('agrees with analyzeLog about the keystream totals', () => {
    // Same fixture shape as the stats suite: three words, one wrong char.
    const ctx = ctxOf(['ab', 'cd', 'ef'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      commitEvent(3, 200),
      insertEvent(4, 1100, 'c'),
      insertEvent(5, 1200, 'd'),
      commitEvent(6, 1300),
      insertEvent(7, 2100, 'x'),
      insertEvent(8, 2200, 'f'),
      commitEvent(9, 2300)
    ]
    const rows = charObservationsOf(ctx, log)
    const analysis = analyzeLog(ctx, log)

    const inserts = rows.filter((r) => r.char !== ' ')
    const presses = inserts.reduce((sum, r) => sum + r.presses, 0)
    const errors = inserts.reduce((sum, r) => sum + r.errors, 0)
    expect(presses).toBe(analysis.totalKeys)
    expect(errors).toBe(analysis.totalKeys - analysis.correctKeys)
    expect(rowOf(rows, ' ')?.presses).toBe(analysis.commitTimes.length)
  })

  it('is a pure function of the log: two passes are identical', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 90, 'b'),
      commitEvent(3, 180),
      insertEvent(4, 260, 'c'),
      insertEvent(5, 350, 'd'),
      commitEvent(6, 430)
    ]
    expect(charObservationsOf(ctx, log)).toEqual(charObservationsOf(ctx, log))
  })

  it('observes nothing for a nospace run beyond its characters (no commits exist)', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true })
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'), // auto-commits inside reduce
      insertEvent(3, 200, 'c'),
      insertEvent(4, 300, 'd')
    ]
    const rows = charObservationsOf(ctx, log)
    expect(rowOf(rows, ' ')).toBeUndefined()
    expect(rows.reduce((sum, r) => sum + r.presses, 0)).toBe(4)
    // The chain survives the auto-commit: every keystroke after the first has
    // an interval.
    expect(rows.reduce((sum, r) => sum + r.intervalCount, 0)).toBe(3)
  })

  it('stops where the reducer stops, so a prefix-judged run recomputes bit-for-bit', () => {
    const ctx = ctxOf(['ab', 'cd'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      commitEvent(3, 200),
      // Backspace into a fully-correct committed word: the reducer REJECTS
      // (BackspaceLocked), the pass ends, and nothing after is observed —
      // exactly where analyzeLog's replay aborts.
      deleteEvent(4, 300, 'char'),
      insertEvent(5, 400, 'c')
    ]
    const rows = charObservationsOf(ctx, log)
    expect(rowOf(rows, 'c')).toBeUndefined()
    expect(rows.map((r) => r.char)).toEqual([' ', 'a', 'b'])
  })

  it('observes nothing at all after a finished run', () => {
    const ctx = ctxOf(['ab'])
    const log: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      commitEvent(3, 200), // completes the run
      insertEvent(4, 300, 'z')
    ]
    expect(rowOf(charObservationsOf(ctx, log), 'z')).toBeUndefined()
  })
})
