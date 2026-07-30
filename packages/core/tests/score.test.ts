// @vitest-environment node
//
// scoreV1 — the base scoring formula (SCORING_CONCEPT.md §1). Covers the two
// forms' equivalence (live scoreStep fold == batch scoreOfLog, bit-identical),
// the hand-computed formula corners, determinism, and gradeOf.
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  type GameState,
  type GenerationConfig,
  type ModsDeclaration,
  DEFAULT_MAX_EXTRA_CHARS,
  GameCore,
  asMs,
  comboMultiplier,
  commitEvent,
  computeMetrics,
  deleteEvent,
  finalizeScore,
  foldLog,
  gradeOf,
  initialScoreState,
  insertEvent,
  netCharsOf,
  separatorsOf,
  SCORE_VERSION_2,
  scoreOfLog,
  scoreStep,
  scoreV2OfLog,
  sortEvents
} from '@typemore/core'

const config = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  ...over
})

/** Deterministic LCG so every failing seed is reproducible (mirrors ghost-driver.test). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Fold scoreStep over a log — the live-accumulation path the store drives. */
function foldScore(events: readonly GameEvent[], ctx: CoreContext) {
  const state = initialScoreState()
  for (const event of sortEvents(events)) scoreStep(state, event, ctx)
  return state
}

// ── Hand-computed table tests (exact numbers) ────────────────────────────────

describe('scoreV1 per-keystroke combo points', () => {
  it('perfect short run: 10 points per key at ×1.0, combo peak = length', () => {
    const ctx: CoreContext = { config: config(), words: ['cat'] }
    const log = [
      insertEvent(1, 0, 'c'),
      insertEvent(2, 80, 'a'),
      insertEvent(3, 160, 't'),
      commitEvent(4, 240)
    ]
    const s = foldScore(log, ctx)
    expect(s.base).toBe(30) // 3 × 10 × 1.0
    expect(s.comboPeak).toBe(3)
    expect(s.streak).toBe(3)
    expect(s.finished).toBe(true) // count mode, only word committed
  })

  it('miss at streak 26 drops the multiplier: streak 25 & 26 score ×1.25, then combo breaks', () => {
    const ctx: CoreContext = { config: config(), words: ['a'.repeat(40)] }
    const log: GameEvent[] = []
    for (let i = 0; i < 26; i++) log.push(insertEvent(i + 1, i * 40, 'a'))
    const built = foldScore(log, ctx)
    // 24 keys at ×1.0 (streaks 1-24) + 2 keys at ×1.25 (streaks 25,26).
    expect(built.base).toBe(24 * 10 + 2 * 12.5) // 265
    expect(built.comboPeak).toBe(26)
    expect(comboMultiplier(26)).toBe(1.25)

    // A wrong 27th key breaks combo; base is unchanged (no negative points).
    scoreStep(built, insertEvent(27, 26 * 40, 'b'), ctx)
    expect(built.streak).toBe(0)
    expect(built.base).toBe(265)
    expect(comboMultiplier(built.streak)).toBe(1)
  })

  it('correction (backspace + retype) scores 0 and does NOT restore the broken combo', () => {
    const ctx: CoreContext = { config: config(), words: ['cat'] }
    const s = foldScore(
      [
        insertEvent(1, 0, 'c'), // streak 1
        insertEvent(2, 80, 'a'), // streak 2
        insertEvent(3, 160, 'x'), // wrong at pos 2 → combo breaks, no points
        deleteEvent(4, 240, 'char'), // backspace the wrong letter
        insertEvent(5, 320, 't') // retype pos 2 correctly — a correction
      ],
      ctx
    )
    expect(s.base).toBe(20) // only 'c' and 'a' ever scored
    expect(s.comboPeak).toBe(2)
    expect(s.streak).toBe(0) // correction did not restore combo
  })

  it('committing a word with a skipped letter resets combo', () => {
    const ctx: CoreContext = { config: config(), words: ['cat', 'dog'] }
    const s = foldScore(
      [
        insertEvent(1, 0, 'c'), // streak 1
        insertEvent(2, 80, 'a'), // streak 2
        commitEvent(3, 160), // "ca" missed 't' → combo resets
        insertEvent(4, 240, 'd') // next word: combo rebuilds from 1
      ],
      ctx
    )
    expect(s.base).toBe(30) // c,a (20) + d (10)
    expect(s.comboPeak).toBe(2)
    expect(s.streak).toBe(1)
  })

  it('multiplier is capped at ×2.5 for streak ≥ 150', () => {
    expect(comboMultiplier(149)).toBe(2.25)
    expect(comboMultiplier(150)).toBe(2.5)
    expect(comboMultiplier(151)).toBe(2.5)
    expect(comboMultiplier(300)).toBe(2.5)

    // Every keystroke past streak 150 adds exactly 10 × 2.5 = 25, never more.
    const ctx: CoreContext = { config: config(), words: ['a'.repeat(200)] }
    const log: GameEvent[] = []
    for (let i = 0; i < 160; i++) log.push(insertEvent(i + 1, i, 'a'))
    const at159 = foldScore(log.slice(0, 159), ctx).base
    const at160 = foldScore(log, ctx).base
    expect(at160 - at159).toBe(25) // 160th key lands at streak 160 (capped)
  })
})

// ── Accuracy and time factors ────────────────────────────────────────────────

describe('scoreV1 final factors', () => {
  it('word-mode timeBonus is exactly 1.0 at 80 WPM', () => {
    // 1 word, 5 correct chars, no trailing space → 5 net chars. Finish at 750ms
    // ⇒ 0.75s ⇒ net WPM 80 ⇒ timeBonus 1.0.
    const ctx: CoreContext = { config: config(), words: ['hello'] }
    const log = [
      insertEvent(1, 0, 'h'),
      insertEvent(2, 100, 'e'),
      insertEvent(3, 200, 'l'),
      insertEvent(4, 300, 'l'),
      insertEvent(5, 400, 'o'),
      commitEvent(6, 750)
    ]
    const result = scoreOfLog(log, ctx)
    expect(result.timeBonus).toBe(1)
    expect(result.accMultiplier).toBe(1)
    expect(result.base).toBe(50)
    expect(result.total).toBe(50) // round(50 × 1 × 1)
    expect(result.version).toBe(1)
    expect(result.comboPeak).toBe(5)
  })

  it('time-mode runs carry no timeBonus (speed is already in keystroke volume)', () => {
    const ctx: CoreContext = {
      config: config({ mode: 'time', durationMs: 2_000 }),
      words: ['ab', 'cd']
    }
    const log = [insertEvent(1, 0, 'a'), insertEvent(2, 100, 'b'), commitEvent(3, 200)]
    const result = scoreOfLog(log, ctx)
    expect(result.timeBonus).toBeNull()
    expect(result.base).toBe(20)
    // acc = 1 (all correct) ⇒ total = round(20 × 1) = 20.
    expect(result.total).toBe(20)
  })

  it('accuracy squares into the total (acc² factor)', () => {
    // "cat" then a wrong extra char: 3 correct keys + 1 wrong = acc 0.75.
    const ctx: CoreContext = { config: config({ mode: 'time', durationMs: 5_000 }), words: ['cat'] }
    const log = [
      insertEvent(1, 0, 'c'),
      insertEvent(2, 80, 'a'),
      insertEvent(3, 160, 't'),
      insertEvent(4, 240, 'x') // extra, wrong → combo break, counts as a key
    ]
    const metrics = computeMetrics(ctx, log, asMs(240))
    expect(metrics.accuracy).toBe(0.75)
    const result = scoreOfLog(log, ctx)
    expect(result.base).toBe(30)
    expect(result.accMultiplier).toBeCloseTo(0.5625, 10) // 0.75²
    expect(result.total).toBe(Math.round(30 * 0.5625)) // 17
  })
})

// ── Equivalence: live fold == batch fold, bit-identical ──────────────────────

/**
 * Build a random but VALID log by dispatching random events to a real GameCore
 * and keeping only the accepted ones — exactly the log the store would record.
 */
function randomLog(rng: () => number, ctx: CoreContext): GameEvent[] {
  const core = new GameCore({ config: ctx.config, words: ctx.words })
  let seq = 0
  let t = 0
  const steps = 80 + Math.floor(rng() * 120)
  for (let i = 0; i < steps && core.state.phase !== 'finished'; i++) {
    t += 1 + Math.floor(rng() * 130)
    const roll = rng()
    let event: GameEvent
    if (roll < 0.72) {
      const wi = core.state.wordIndex
      const target = ctx.words[wi] ?? ''
      const pos = (core.state.input[wi] ?? '').length
      const correctChar = target[pos] ?? 'z'
      const char = rng() < 0.82 ? correctChar : 'x' // mostly correct, some typos/extras
      event = insertEvent(++seq, t, char)
    } else if (roll < 0.88) {
      event = deleteEvent(++seq, t, rng() < 0.8 ? 'char' : 'word')
    } else {
      event = commitEvent(++seq, t)
    }
    core.dispatch(event)
  }
  return core.events.slice()
}

describe('scoreV1 equivalence (property): scoreStep fold == scoreOfLog', () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

  it.each(SEEDS)('word mode: live accumulation matches the batch fold (seed %i)', (seed) => {
    const ctx: CoreContext = { config: config(), words: ['hello', 'world', 'foo', 'bar', 'baz'] }
    const log = randomLog(lcg(seed), ctx)
    const endMs = log.length > 0 ? log[log.length - 1].t : asMs(0)

    const state = foldScore(log, ctx)
    const viaStep = finalizeScore(
      state.base,
      state.comboPeak,
      computeMetrics(ctx, log, endMs),
      ctx.config.mode
    )
    const viaLog = scoreOfLog(log, ctx)
    expect(viaStep).toEqual(viaLog)
  })

  it.each(SEEDS)('time mode: live accumulation matches the batch fold (seed %i)', (seed) => {
    const ctx: CoreContext = {
      config: config({ mode: 'time', durationMs: 4_000 }),
      words: ['hello', 'world', 'foo', 'bar', 'baz']
    }
    const log = randomLog(lcg(seed + 1000), ctx)
    const endMs = log.length > 0 ? log[log.length - 1].t : asMs(0)

    const state = foldScore(log, ctx)
    const viaStep = finalizeScore(
      state.base,
      state.comboPeak,
      computeMetrics(ctx, log, endMs),
      ctx.config.mode
    )
    const viaLog = scoreOfLog(log, ctx)
    expect(viaStep).toEqual(viaLog)
    expect(viaLog.timeBonus).toBeNull()
  })
})

// ── Determinism ──────────────────────────────────────────────────────────────

describe('scoreV1 determinism', () => {
  it('scoring the same log twice yields an identical result object', () => {
    const ctx: CoreContext = { config: config(), words: ['hello', 'world', 'foo'] }
    const log = randomLog(lcg(7), ctx)
    expect(scoreOfLog(log, ctx)).toEqual(scoreOfLog(log, ctx))
  })
})

// ── gradeOf ──────────────────────────────────────────────────────────────────

describe('gradeOf (SCORING_CONCEPT §4)', () => {
  it('maps accuracy fractions to SS/S/A/B/C at the documented thresholds', () => {
    expect(gradeOf(1)).toBe('SS')
    expect(gradeOf(0.999)).toBe('S')
    expect(gradeOf(0.98)).toBe('S')
    expect(gradeOf(0.979)).toBe('A')
    expect(gradeOf(0.95)).toBe('A')
    expect(gradeOf(0.949)).toBe('B')
    expect(gradeOf(0.9)).toBe('B')
    expect(gradeOf(0.899)).toBe('C')
    expect(gradeOf(0)).toBe('C')
  })
})

// ── scoreV2: the mod layer over scoreV1 ──────────────────────────────────────

const genV2 = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 10,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})
const NO_MODS: ModsDeclaration = { blind: false, fading: false, flashlight: false }
const V2_WORDS = ['hello', 'world', 'foo', 'bar', 'baz']

describe('scoreV2 zero-mods regression (property): total === scoreV1 exactly', () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

  it.each(SEEDS)('word mode, no mods active (seed %i)', (seed) => {
    const ctx: CoreContext = { config: config(), words: V2_WORDS }
    const log = randomLog(lcg(seed), ctx)
    const v1 = scoreOfLog(log, ctx)
    const v2 = scoreV2OfLog(
      log,
      { config: ctx.config, words: ctx.words, generation: genV2() },
      NO_MODS
    )
    expect(v2.total).toBe(v1.total)
    expect(v2.version).toBe(SCORE_VERSION_2)
    expect(v2.modMultiplier).toBe(1)
  })

  it.each(SEEDS.slice(0, 20))('time mode, no mods active (seed %i)', (seed) => {
    const ctx: CoreContext = {
      config: config({ mode: 'time', durationMs: 4_000 }),
      words: V2_WORDS
    }
    const log = randomLog(lcg(seed + 1000), ctx)
    const v1 = scoreOfLog(log, ctx)
    const v2 = scoreV2OfLog(
      log,
      { config: ctx.config, words: ctx.words, generation: genV2({ mode: 'time' }) },
      NO_MODS
    )
    expect(v2.total).toBe(v1.total)
  })
})

/**
 * Compatibility proof for the `\n` separator rule: for any word list WITHOUT a
 * newline — i.e. every dictionary published so far — the new accounting must be
 * bit-identical to the pre-change formula, which is spelled out here as the
 * oracle. This is what justifies shipping the rule with no `SCORE_VERSION` /
 * `EVENT_LOG_VERSION` bump: no stored run's numbers can move.
 */
describe("separator rule regression (property): no '\\n' => pre-change numbers", () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

  /** The formula as it was before code dictionaries: one separator per commit. */
  const legacySpaces = (ctx: CoreContext, state: GameState): number => {
    const committed = Math.min(state.wordIndex, ctx.words.length)
    const finishedByCount =
      state.phase === 'finished' && ctx.config.mode !== 'time' && ctx.config.mode !== 'free'
    return finishedByCount ? Math.max(0, committed - 1) : committed
  }

  it.each(SEEDS)('word mode (seed %i)', (seed) => {
    const ctx: CoreContext = { config: config(), words: V2_WORDS }
    const log = randomLog(lcg(seed), ctx)
    const state = foldLog(ctx, log)._unsafeUnwrap()
    const metrics = computeMetrics(ctx, log, asMs(state.finishedAt ?? 60_000))

    expect(separatorsOf(ctx, state)).toBe(legacySpaces(ctx, state))
    expect(metrics.spaces).toBe(legacySpaces(ctx, state))
    expect(netCharsOf(ctx, state)).toBe(metrics.chars.correct + legacySpaces(ctx, state))
  })

  it.each(SEEDS.slice(0, 20))('time mode (seed %i)', (seed) => {
    const ctx: CoreContext = {
      config: config({ mode: 'time', durationMs: 4_000 }),
      words: V2_WORDS
    }
    const log = randomLog(lcg(seed + 1000), ctx)
    const state = foldLog(ctx, log)._unsafeUnwrap()

    expect(separatorsOf(ctx, state)).toBe(legacySpaces(ctx, state))
  })
})

describe('scoreV2 mods scale the total, never base/acc', () => {
  it('a declared mod (blind) multiplies the total, leaving base/comboPeak/acc untouched', () => {
    const ctx: CoreContext = { config: config(), words: V2_WORDS }
    const log = randomLog(lcg(7), ctx)
    const setup = { config: ctx.config, words: ctx.words, generation: genV2() }
    const plain = scoreV2OfLog(log, setup, NO_MODS)
    const blind = scoreV2OfLog(log, setup, { blind: true, fading: false, flashlight: false })
    expect(blind.base).toBe(plain.base)
    expect(blind.comboPeak).toBe(plain.comboPeak)
    expect(blind.accMultiplier).toBe(plain.accMultiplier)
    expect(blind.modMultiplier).toBeCloseTo(1.3, 10)
    expect(blind.total).toBe(
      Math.round(plain.base * plain.accMultiplier * (plain.timeBonus ?? 1) * 1.3)
    )
  })

  it('a verifiable mod (punctuation) scales via generation, base unchanged', () => {
    const ctx: CoreContext = { config: config(), words: V2_WORDS }
    const log = randomLog(lcg(9), ctx)
    const plain = scoreV2OfLog(
      log,
      { config: ctx.config, words: ctx.words, generation: genV2() },
      NO_MODS
    )
    const punct = scoreV2OfLog(
      log,
      { config: ctx.config, words: ctx.words, generation: genV2({ punctuation: true }) },
      NO_MODS
    )
    expect(punct.modMultiplier).toBeCloseTo(1.1, 10)
    expect(punct.base).toBe(plain.base)
  })
})
