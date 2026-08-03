// @vitest-environment node
//
// THE SPEED DETECTOR — the one flag with a zero false-positive rate on the real
// population, and the one that a single typo used to switch off completely.
//
// What this file is defending, in one sentence: `superhuman-burst` fires on
// SPEED and is scaled by accuracy, rather than being GATED on accuracy. The old
// rule was `metrics.wpm > 250 && metrics.accuracy === 1` — a strict equality
// with one — so a 336.2 wpm run held for a full minute at 99.6% accuracy was
// accepted at suspicion 0.0074, while a 282 wpm run of ten seconds at 100% was
// flagged. It is trivially gameable (make one deliberate mistake), it fires or
// not by luck, and because `sustained_superhuman` requires the flag to be
// present, the combination rule was disabled along with it.
import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  BURST_CEILING,
  DEFAULT_THRESHOLDS,
  EVENT_LOG_VERSION,
  burstAccuracyWeight,
  commitEvent,
  dictVersion,
  insertEvent,
  maxBurstWpmFor,
  validateLog
} from '@typemore/core'

// ── f(acc): the scaler that replaced the gate ─────────────────────────────────

describe('burstAccuracyWeight', () => {
  const GRID = [0.5, 0.8, 0.9, 0.95, 0.99, 0.996, 0.999, 1.0]

  it('is exactly 1 at flawless accuracy', () => {
    expect(burstAccuracyWeight(1)).toBe(1)
  })

  it('is strictly increasing across the whole human range', () => {
    for (let i = 1; i < GRID.length; i++) {
      expect(burstAccuracyWeight(GRID[i])).toBeGreaterThan(burstAccuracyWeight(GRID[i - 1]))
    }
  })

  it('never reaches zero, which is the entire point of replacing the gate', () => {
    for (const acc of [...GRID, 0.25, 0]) expect(burstAccuracyWeight(acc)).toBeGreaterThan(0)
    // The floor is what guarantees it. A detector that can be switched off by
    // being sloppy is the hole this change closes.
    expect(burstAccuracyWeight(0)).toBeCloseTo(0.25, 12)
  })

  it('charges one typo in a minute almost nothing, where the gate charged everything', () => {
    // 0.996 is the accuracy of the run that started this investigation.
    expect(burstAccuracyWeight(0.996)).toBeGreaterThan(0.98)
    // ...and still separates fast-and-accurate from fast-and-messy.
    expect(burstAccuracyWeight(0.9)).toBeLessThan(0.8)
    expect(burstAccuracyWeight(0.5)).toBeLessThan(0.35)
  })

  it('keeps the product a severity — inside [0, 1] however fast the run', () => {
    for (const acc of GRID) {
      const severity = Math.min(1, 1000 / 500) * burstAccuracyWeight(acc)
      expect(severity).toBeGreaterThanOrEqual(0)
      expect(severity).toBeLessThanOrEqual(1)
    }
  })

  it('clamps an out-of-range accuracy rather than extrapolating', () => {
    expect(burstAccuracyWeight(1.5)).toBe(burstAccuracyWeight(1))
    expect(burstAccuracyWeight(-1)).toBe(burstAccuracyWeight(0))
  })
})

// ── The ceiling as a function of distance ────────────────────────────────────

describe('maxBurstWpmFor', () => {
  it('pins the anchors themselves', () => {
    expect(maxBurstWpmFor(15)).toBe(250)
    expect(maxBurstWpmFor(30)).toBe(210)
    expect(maxBurstWpmFor(60)).toBe(200)
  })

  it('is flat below the first anchor and above the last', () => {
    expect(maxBurstWpmFor(10)).toBe(250)
    expect(maxBurstWpmFor(1)).toBe(250)
    expect(maxBurstWpmFor(0)).toBe(250)
    expect(maxBurstWpmFor(120)).toBe(200)
    expect(maxBurstWpmFor(3600)).toBe(200)
  })

  it('interpolates between them', () => {
    // Half way from 15 s to 30 s is half way from 250 to 210.
    expect(maxBurstWpmFor(22.5)).toBeCloseTo(230, 12)
    // Half way from 30 s to 60 s is half way from 210 to 200.
    expect(maxBurstWpmFor(45)).toBeCloseTo(205, 12)
  })

  it('is continuous — no cliff a fifth of a second wide', () => {
    // The reason for interpolating at all: a step table judges 29.9 s against
    // one number and 30.1 s against another 40 wpm lower, and two identical
    // typists land on opposite sides of it by accident.
    for (const at of [15, 30, 60]) {
      const below = maxBurstWpmFor(at - 0.001)
      const above = maxBurstWpmFor(at + 0.001)
      expect(Math.abs(above - below)).toBeLessThan(0.01)
    }
  })

  it('is monotonically non-increasing — longer is never judged more leniently', () => {
    let previous = Infinity
    for (let sec = 0; sec <= 200; sec += 0.25) {
      const ceiling = maxBurstWpmFor(sec)
      expect(ceiling).toBeLessThanOrEqual(previous + 1e-9)
      previous = ceiling
    }
  })

  it('reads its anchors from the table, so the table is the only place to tune', () => {
    expect(BURST_CEILING.map((a) => a.wpm)).toEqual([250, 210, 200])
    for (let i = 1; i < BURST_CEILING.length; i++) {
      expect(BURST_CEILING[i].durationSec).toBeGreaterThan(BURST_CEILING[i - 1].durationSec)
      expect(BURST_CEILING[i].wpm).toBeLessThanOrEqual(BURST_CEILING[i - 1].wpm)
    }
    expect(DEFAULT_THRESHOLDS.burstCeiling).toBe(BURST_CEILING)
  })

  it('honours a caller-supplied table', () => {
    const flat = [{ durationSec: 15, wpm: 999 }]
    expect(maxBurstWpmFor(60, flat)).toBe(999)
  })
})

// ── The detector, driven through validateLog ─────────────────────────────────

/**
 * A timed run of `durationMs` that types `words` of one repeated target, with
 * `wrongKeys` of the keystrokes deliberately mistyped.
 *
 * Timed mode is what makes the arithmetic exact: `finishedAt` is pinned to the
 * deadline, so `durationSec` is the configured duration and not whatever the
 * last event happened to say. Net WPM is then `words × (len + 1) / 5 / minutes`
 * for a run of correct words — which is what lets a test ASK for a speed.
 */
const WORD = 'abcde'
const dict: Dictionary = { name: 'burst', bcp47: 'en', words: [WORD] }

// Generation is `words` while the CONFIG is `time`: the two are independent
// inputs to `validateLog`, and a timed generation caps the list at
// `max(60, 6 × seconds)` targets — which a superhuman run types straight
// through, after which every keystroke lands past the end of the word list and
// the run reads as 19% accuracy instead of the speed it was built to have.
const generationFor = (words: number): GenerationConfig => ({
  mode: 'words',
  length: words + 4,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
})

function runAt(durationMs: number, words: number, wrongKeys = 0): EventLog {
  const events: GameEvent[] = []
  let seq = 1
  let key = 0
  // Spread the keystrokes evenly across 90% of the window, so the last event
  // stays inside the deadline (an event at/after it invalidates the log).
  const total = words * (WORD.length + 1)
  const step = (durationMs * 0.9) / Math.max(1, total)
  let t = 0
  for (let w = 0; w < words; w++) {
    for (const ch of WORD) {
      // Errors are placed at the START of the run so every later word is still
      // whole: a wrong character inside a word would zero that word's NET
      // credit and change the speed as well as the accuracy.
      const wrong = key < wrongKeys
      events.push(insertEvent(seq++, Math.round(t), wrong ? 'z' : ch))
      key++
      t += step
    }
    events.push(commitEvent(seq++, Math.round(t)))
    t += step
  }
  return { version: EVENT_LOG_VERSION, events }
}

function report(durationMs: number, words: number, wrongKeys = 0) {
  const config: CoreConfig = {
    mode: 'time',
    durationMs,
    maxExtraChars: 20,
    difficulty: 'normal',
    nospace: false,
    minWpm: 0
  }
  const snapshot: ConfigSnapshot = { config, generation: generationFor(words) }
  const result = validateLog({
    seed: 1,
    dictionary: dict,
    dictVersion: dictVersion(dict.words),
    configSnapshot: snapshot,
    log: runAt(durationMs, words, wrongKeys)
  })
  return result._unsafeUnwrap()
}

const burstOf = (r: ReturnType<typeof report>) => r.flags.find((f) => f.code === 'superhuman-burst')

describe('superhuman-burst fires on speed, whatever the accuracy', () => {
  // The arithmetic these counts come from: a correct 5-letter word plus its
  // separator is 6 net characters, so a 60 s run of W words is `6W / 5` wpm.
  // 166 words = 199.2 (under the 200 ceiling), 250 words = 300.
  const FAST_60 = 250

  it('does not fire on a run at or below the ceiling', () => {
    const r = report(60_000, 166)
    expect(r.metrics.wpm).toBeLessThan(maxBurstWpmFor(60))
    expect(burstOf(r)).toBeUndefined()
  })

  it('fires on the same run made faster, at flawless accuracy', () => {
    const r = report(60_000, FAST_60)
    expect(r.metrics.accuracy).toBe(1)
    expect(r.metrics.wpm).toBeGreaterThan(maxBurstWpmFor(60))
    expect(burstOf(r)?.score).toBeGreaterThan(0)
  })

  it('STILL fires when one keystroke is wrong — the regression this release is', () => {
    // The whole finding, as a test. Same speed, one typo. Under the old rule
    // `accuracy === 1` was false and the flag vanished, taking
    // `sustained_superhuman` with it; a single character bought immunity.
    const r = report(60_000, FAST_60, 1)
    expect(r.metrics.accuracy).toBeLessThan(1)
    expect(r.metrics.accuracy).toBeGreaterThan(0.99)
    const flag = burstOf(r)
    expect(flag).toBeDefined()
    expect(flag?.score).toBeGreaterThan(0)
  })

  it('charges the typo a little, not everything', () => {
    const clean = burstOf(report(60_000, FAST_60))?.score ?? 0
    const typo = burstOf(report(60_000, FAST_60, 1))?.score ?? 0
    expect(typo).toBeLessThan(clean)
    expect(typo).toBeGreaterThan(clean * 0.95)
  })

  it('judges the same speed differently at different distances', () => {
    // 210 wpm: over the 60 s ceiling (200), under the 15 s one (250). The old
    // single constant could not say that, and it is why a minute of 336 wpm
    // passed while a ten-second flurry of 251 did not.
    // 29 words in 10 s and 174 in 60 s are both 208.8 wpm, exactly.
    const short = report(10_000, 29)
    const long = report(60_000, 174)
    expect(short.metrics.wpm).toBeCloseTo(long.metrics.wpm, 0)
    expect(burstOf(short)).toBeUndefined()
    expect(burstOf(long)).toBeDefined()
  })

  it('reports the ceiling it judged against, so a verdict can be read back', () => {
    const flag = burstOf(report(60_000, FAST_60))
    expect(flag?.detail).toContain('ceiling 200')
    expect(flag?.detail).toContain('60s')
  })
})

describe('the ceiling boundary is exclusive on the low side', () => {
  it('a run exactly at the ceiling is not flagged, one above it is', () => {
    // Built by binary search on the word count rather than by arithmetic, so
    // the test states which side of `>` is inclusive by DEMONSTRATING it.
    const ceiling = maxBurstWpmFor(60)
    let below = 0
    let above = 0
    for (let words = 160; words <= 175; words++) {
      const wpm = report(60_000, words).metrics.wpm
      if (wpm < ceiling) below = words
      else if (wpm > ceiling && above === 0) above = words
    }
    expect(below).toBeGreaterThan(0)
    expect(above).toBeGreaterThan(0)
    expect(burstOf(report(60_000, below))).toBeUndefined()
    expect(burstOf(report(60_000, above))).toBeDefined()
  })
})
