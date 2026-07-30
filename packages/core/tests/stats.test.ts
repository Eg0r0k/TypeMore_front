import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  DEFAULT_MAX_EXTRA_CHARS,
  GameCore,
  afkOf,
  afkStatsOf,
  asMs,
  commitEvent,
  computeMetrics,
  consistencyOf,
  errorWords,
  foldLog,
  insertEvent,
  wpmOverTime
} from '@shared/core'

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

// Three words over ~2.3s. Word 2 ('ef') is mistyped as 'xf' (wrong char at pos 0).
const words = ['ab', 'cd', 'ef']
const ctx = ctxOf(words)
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
const endMs = asMs(2300)

describe('errorWords', () => {
  it('lists committed words whose typed text differs from the target', () => {
    expect(errorWords(ctx, log)).toEqual([{ expected: 'ef', typed: 'xf' }])
  })

  it('is empty when every committed word is correct', () => {
    const clean: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      commitEvent(3, 200),
      insertEvent(4, 300, 'c'),
      insertEvent(5, 400, 'd'),
      commitEvent(6, 500),
      insertEvent(7, 600, 'e'),
      insertEvent(8, 700, 'f'),
      commitEvent(9, 800)
    ]
    expect(errorWords(ctx, clean)).toEqual([])
  })
})

describe('wpmOverTime', () => {
  it('produces one point per elapsed second', () => {
    const points = wpmOverTime(ctx, log, endMs)
    expect(points).toHaveLength(3)
    expect(points.map((p) => p.second)).toEqual([1, 2, 3])
  })

  it('buckets error keystrokes into the second they occurred', () => {
    const points = wpmOverTime(ctx, log, endMs)
    // The only wrong key ('x' at t=2100) lands in the third bucket.
    expect(points.map((p) => p.errors)).toEqual([0, 0, 1])
    const totalErrors = points.reduce((sum, p) => sum + p.errors, 0)
    expect(totalErrors).toBe(1)
  })

  it("final cumulative wpm equals the summary wpm (they share the log's char/space model)", () => {
    const metrics = computeMetrics(ctx, log, endMs)
    const points = wpmOverTime(ctx, log, endMs)
    const last = points[points.length - 1]
    expect(Math.abs(last.wpm - metrics.wpm)).toBeLessThan(1e-6)
  })

  it('returns no points before the test has started', () => {
    expect(wpmOverTime(ctx, [], asMs(0))).toEqual([])
  })

  // Regression: a count-mode run finishes ON its last keystroke, so the trailing
  // bucket is a few ms wide. Dividing the keys inside it by that sliver used to
  // put the last point past 1000 wpm; the rate window is a full second now.
  it('does not spike the trailing point when the run ends inside a bucket', () => {
    const tailCtx = ctxOf(['abcdef'])
    const tailLog: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      insertEvent(3, 1000, 'c'),
      insertEvent(4, 2000, 'd'),
      insertEvent(5, 2005, 'e')
    ]
    // 2.01s elapsed: the third bucket is 10ms wide and holds two keystrokes.
    const points = wpmOverTime(tailCtx, tailLog, asMs(2010))

    expect(points).toHaveLength(3)
    // 2 keys over the second before the finish — not 2 keys over 10ms (×2400).
    expect(points[2].raw).toBeCloseTo(24, 10)
    expect(Math.max(...points.map((p) => p.raw))).toBeLessThan(100)
  })
})

/**
 * A code/quote target ends its own line with a typed `\n`, so that word must NOT
 * also be credited the phantom separator every commit adds — otherwise the same
 * keystrokes score one net character more per line than the prose shape does.
 */
describe("separator accounting for '\\n' targets", () => {
  const typeWords = (words: string[], typed: string[]) => {
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (const text of typed) {
      for (const ch of text) events.push(insertEvent(seq++, (t += 100), ch))
      events.push(commitEvent(seq++, (t += 100)))
    }
    return computeMetrics({ config: config(), words }, events, asMs(t))
  }

  it('counts the newline as the separator instead of adding one on top', () => {
    const plain = typeWords(['ab', 'cd'], ['ab', 'cd'])
    const code = typeWords(['ab\n', 'cd'], ['ab\n', 'cd'])

    // Prose: 4 correct chars + 1 separator. Code: the '\n' IS the separator, so
    // 5 correct chars + 0 for that word — the same 5 net characters. (The code
    // run's wpm is lower on purpose: typing the newline really is one more key,
    // so the same 5 characters took one keystroke longer.)
    expect(plain.chars.correct + plain.spaces).toBe(5)
    expect(code.chars.correct + code.spaces).toBe(5)
    expect(code.spaces).toBe(0)
    expect(code.chars.correct).toBe(5)
  })

  it('still credits the space-separated words of a mixed line', () => {
    // `const x = 1;\n` typed as four targets: three spaces, then a newline end.
    const mixed = typeWords(['const', 'x', '=', '1;\n'], ['const', 'x', '=', '1;\n'])
    expect(mixed.spaces).toBe(3)
  })

  it('keeps the cumulative chart in step with the summary', () => {
    const words = ['ab\n', 'cd']
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (const text of ['ab\n', 'cd']) {
      for (const ch of text) events.push(insertEvent(seq++, (t += 300), ch))
      events.push(commitEvent(seq++, (t += 300)))
    }
    const ctx = { config: config(), words }
    const points = wpmOverTime(ctx, events, asMs(t))
    const metrics = computeMetrics(ctx, events, asMs(t))

    expect(points[points.length - 1].wpm).toBeCloseTo(metrics.wpm, 10)
  })
})

describe('replay invariance (pure functions of the log)', () => {
  it('yields byte-identical timeline + error words on a second replay', () => {
    expect(wpmOverTime(ctx, log, endMs)).toEqual(wpmOverTime(ctx, log, endMs))
    expect(errorWords(ctx, log)).toEqual(errorWords(ctx, log))
  })

  it('matches the state reconstructed by foldLog (same navigation semantics)', () => {
    const final = foldLog(ctx, log)._unsafeUnwrap()
    expect(final.phase).toBe('finished')
    // errorWords must reflect exactly the committed buffers foldLog produced.
    expect(errorWords(ctx, log)).toEqual([{ expected: 'ef', typed: final.input[2] }])
  })
})

describe('consistencyOf — kogasa over per-second raw WPM, on [0, 1]', () => {
  it('is 0 for an empty series and for a series with zero mean', () => {
    expect(consistencyOf([])).toBe(0)
    expect(consistencyOf([0, 0, 0])).toBe(0)
  })

  it('is exactly 1 when every bucket runs at the same speed (cov = 0)', () => {
    expect(consistencyOf([60])).toBe(1)
    expect(consistencyOf([60, 60, 60])).toBe(1)
  })

  it('depends only on the coefficient of variation, not the absolute speed', () => {
    // Doubling every bucket is exact in floats, so the cov — and the result —
    // are bit-identical.
    expect(consistencyOf([30, 90])).toBe(consistencyOf([60, 180]))
  })

  it('falls as variance grows around the same mean', () => {
    expect(consistencyOf([50, 70])).toBeGreaterThan(consistencyOf([20, 100]))
  })

  it('maps a hand-computed cov through the kogasa curve', () => {
    // [30, 90]: mean 60, population sd 30, cov 0.5.
    const cov = 0.5
    const expected = 1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5)
    expect(consistencyOf([30, 90])).toBeCloseTo(expected, 15)
  })
})

describe('metrics consistency — a pure function of the per-second buckets', () => {
  it('hand vector: a run with known per-second variance has the known consistency', () => {
    // One long word, never committed: 2 keys in second 1, 6 keys in second 2,
    // measured to the grid-aligned instant 2000 — buckets of 24 and 72 raw WPM,
    // mean 48, sd 24, cov exactly 0.5.
    const handCtx = ctxOf(['aaaaaaaa'])
    const handLog: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'a'),
      insertEvent(3, 1000, 'a'),
      insertEvent(4, 1100, 'a'),
      insertEvent(5, 1200, 'a'),
      insertEvent(6, 1300, 'a'),
      insertEvent(7, 1400, 'a'),
      insertEvent(8, 1500, 'a')
    ]
    const metrics = computeMetrics(handCtx, handLog, asMs(2000))
    expect(wpmOverTime(handCtx, handLog, asMs(2000)).map((p) => p.raw)).toEqual([24, 72])
    expect(metrics.consistency).toBe(consistencyOf([24, 72]))
    const cov = 0.5
    expect(metrics.consistency).toBeCloseTo(1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5), 15)
  })

  it('boundary: a one-second run is one bucket, and one bucket reads 1', () => {
    const oneCtx = ctxOf(['abcdef'])
    const oneLog: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 200, 'b'),
      insertEvent(3, 400, 'c')
    ]
    expect(computeMetrics(oneCtx, oneLog, asMs(1000)).consistency).toBe(1)
    // Sub-second runs collapse to the same single bucket.
    expect(computeMetrics(oneCtx, oneLog, asMs(500)).consistency).toBe(1)
  })

  it('boundary: zero raw — a run window with no keystrokes at all — reads 0', () => {
    // Only a 'go' run has a window without a single event.
    const goCtx = ctxOf(['abcdef'], { startPolicy: 'go' })
    const metrics = computeMetrics(goCtx, [], asMs(3000))
    expect(metrics.raw).toBe(0)
    expect(metrics.consistency).toBe(0)
  })

  it('consumes exactly the per-second buckets the results chart plots', () => {
    // The shared fixture ends on the grid; the tail fixture ends inside a
    // bucket, so this pins both the whole-second and the trailing-window rule.
    expect(computeMetrics(ctx, log, endMs).consistency).toBe(
      consistencyOf(wpmOverTime(ctx, log, endMs).map((p) => p.raw))
    )
    const tailCtx = ctxOf(['abcdef'])
    const tailLog: GameEvent[] = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 100, 'b'),
      insertEvent(3, 1000, 'c'),
      insertEvent(4, 2000, 'd'),
      insertEvent(5, 2005, 'e')
    ]
    expect(computeMetrics(tailCtx, tailLog, asMs(2010)).consistency).toBe(
      consistencyOf(wpmOverTime(tailCtx, tailLog, asMs(2010)).map((p) => p.raw))
    )
  })
})

describe('chars breakdown — correct / incorrect / extra / missed', () => {
  it('counts extra as inputs beyond the target and missed as tails skipped by commit', () => {
    // word 0 'abcd' committed after 'ab'   → correct 2, missed 2 (skipped tail)
    // word 1 'ab' typed 'axq' and committed → correct 1, incorrect 1, extra 1
    // word 2 'ab' typed 'a', never committed → correct 1, and NO missed —
    //   an in-flight word's untyped tail is not missed until commit skips it
    const charsCtx = ctxOf(['abcd', 'ab', 'ab'])
    const charsLog: GameEvent[] = [
      insertEvent(1, 100, 'a'),
      insertEvent(2, 200, 'b'),
      commitEvent(3, 300),
      insertEvent(4, 400, 'a'),
      insertEvent(5, 500, 'x'),
      insertEvent(6, 600, 'q'),
      commitEvent(7, 700),
      insertEvent(8, 800, 'a')
    ]
    const metrics = computeMetrics(charsCtx, charsLog, asMs(1000))
    expect(metrics.chars).toEqual({ correct: 4, incorrect: 1, extra: 1, missed: 2 })
    expect(metrics.spaces).toBe(2)
    // The keystream view agrees: 6 inserts, of which the wrong 'x' and the
    // beyond-target 'q' are the only incorrect keys.
    expect(metrics.accuracy).toBeCloseTo(4 / 6, 15)
  })
})

describe('afkOf — whole one-second idle buckets', () => {
  // One long word: every event is an insert into word 0, so the bucket grid is
  // the only variable left in the log.
  const word = 'abcdefghij'
  const afkCtx = ctxOf([word])
  const typeAt = (times: readonly number[]): GameEvent[] =>
    times.map((t, i) => insertEvent(i + 1, t, word[i]))

  it('counts nothing when every bucket of the run window holds an event', () => {
    expect(afkOf(afkCtx, typeAt([0, 400, 800, 1200, 1600, 2000, 2400, 2800]), asMs(3000))).toEqual({
      afkMs: 0,
      buckets: 0
    })
  })

  it('counts the four whole buckets that fall inside a 5 s gap', () => {
    // Window 0..6000 = 6 buckets; typing occupies buckets 1 and 6, so the gap
    // between t=500 and t=5500 leaves buckets 2, 3, 4 and 5 empty.
    expect(afkOf(afkCtx, typeAt([0, 500, 5500, 6000]), asMs(6000))).toEqual({
      afkMs: 4000,
      buckets: 4
    })
  })

  it('puts an event exactly on a bucket edge in the earlier bucket', () => {
    // t=1000 closes bucket 1 = (0, 1000], leaving bucket 2 = (1000, 2000] idle.
    // On the opposite grid this log would report zero idle seconds.
    expect(afkOf(afkCtx, typeAt([0, 1000]), asMs(2000))).toEqual({ afkMs: 1000, buckets: 1 })
  })

  it('never counts a partial trailing bucket, so afk can not exceed the run window', () => {
    const goCtx = ctxOf([word], { startPolicy: 'go' })
    // Idle from GO for 2.5 s: two whole buckets, and the 500 ms remainder is dropped.
    expect(afkOf(goCtx, [], asMs(2500))).toEqual({ afkMs: 2000, buckets: 2 })
  })

  it("counts the trailing idle of a timed 'go' run up to the pinned deadline", () => {
    const core = new GameCore({
      config: config({ mode: 'time', durationMs: 30_000, startPolicy: 'go' }),
      words: [word]
    })
    for (const event of typeAt([0, 1000, 2000, 3000])) core.dispatch(event)
    core.tick(asMs(40_000)) // late tick: finishedAt is pinned to the deadline, not to the tick
    expect(core.state.finishedAt).toBe(30_000)
    // Typing fills buckets 1..3; the rest of the pinned 30 s window is idle.
    expect(afkStatsOf(core)).toEqual({ afkMs: 27_000, buckets: 27 })
  })
})
