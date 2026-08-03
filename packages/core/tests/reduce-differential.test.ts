// @vitest-environment node
//
// DIFFERENTIAL PROPERTY SUITE — old reducer vs new, on randomised logs.
//
// Stage B2 replaced the reducer's per-event `input.slice()` (O(words) a
// keystroke, i.e. a quadratic fold) with shared copy-on-read buffers plus
// incremental separator/character counters, collapsed two redundant replays out
// of the server's judgement, and linearised `wpmOverTime`. Every one of those is
// an optimisation, so the ONLY acceptable behavioural delta is none.
//
// `__oracle__/` holds the pre-B2 implementations verbatim (see the headers
// there). This suite diffs the shipped core against them:
//   - every intermediate state, compared as a WHOLE object with `toEqual`
//   - every rejection, compared by kind + seq
//   - the derived read models (`separatorsOf`, `netCharsOf`, `targetCharsOf`,
//     `progressOf`, `minSpeedFailInstant`) at every step
//   - full `Metrics`, `wpmOverTime` points, `errorWords` and AFK accounting
//   - the two collapsed folds, as the exact equivalences that justified them
//
// Coverage is deliberately wider than the perf fixture, which is inserts and
// commits only: the generators below include delete-heavy and replace-heavy
// shapes, every difficulty, nospace / freedomMode / stopOnError / quickEnd /
// MinSpeed, both count and timed modes, and BOTH text-source kinds (seeded and
// quote), because a quote's targets carry newlines and `endsLine` is exactly
// what the separator counter has to keep straight.
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type Dictionary,
  type GameEvent,
  type GameState,
  type GenerationConfig,
  type Ms,
  DEFAULT_MAX_EXTRA_CHARS,
  analyzeLog,
  afkBetween,
  asMs,
  commitEvent,
  computeMetrics,
  consistencyOf,
  deleteEvent,
  errorWords,
  foldLog,
  generateWords,
  initialStateOf,
  insertEvent,
  makeSeedContext,
  minSpeedFailInstant,
  mulberry32,
  netCharsOf,
  progressOf,
  reduce,
  replaceEvent,
  separatorsOf,
  settle,
  sortEvents,
  targetCharsOf,
  wpmOverTime
} from '@typemore/core'

import {
  legacyFoldLog,
  legacyInitialStateOf,
  legacyMinSpeedFailInstant,
  legacyNetCharsOf,
  legacyProgressOf,
  legacyReduce,
  legacySeparatorsOf,
  legacySettle,
  legacyTargetCharsOf
} from './__oracle__/reduce-legacy'
import {
  legacyAfkOf,
  legacyComputeMetrics,
  legacyErrorWords,
  legacyWpmOverTime
} from './__oracle__/stats-legacy'

// ── Word lists ───────────────────────────────────────────────────────────────

const DICT: Dictionary = {
  language: 'diff',
  words: [
    'the',
    'quick',
    'brown',
    'fox',
    'jumps',
    'over',
    'lazy',
    'dog',
    'hello',
    'world',
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon'
  ]
}

/** A quote whose lines end in `\n` — the `endsLine` path the separator counter must respect. */
const QUOTE_TEXT = 'to be\n or not to be\n that is\n the question\n said he'
function wordsFor(kind: 'seeded' | 'quote', seed: number, count: number): readonly string[] {
  const generation: GenerationConfig =
    kind === 'quote'
      ? {
          mode: 'quote',
          length: 0,
          punctuation: false,
          numbers: false,
          randomCase: false,
          reverse: false,
          textSource: {
            kind: 'quote',
            quoteId: 'diff-1',
            quoteHash: 'unused-here',
            text: QUOTE_TEXT
          }
        }
      : {
          mode: 'words',
          length: count,
          punctuation: seed % 3 === 0,
          numbers: seed % 4 === 0,
          randomCase: false,
          reverse: false
        }
  const generated = generateWords(DICT, makeSeedContext(DICT, seed, generation))
  return generated._unsafeUnwrap().words
}

// ── Config matrix ────────────────────────────────────────────────────────────

const base: CoreConfig = {
  mode: 'words',
  durationMs: 6_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

interface Variant {
  readonly name: string
  readonly config: CoreConfig
  readonly source: 'seeded' | 'quote'
}

const VARIANTS: readonly Variant[] = [
  { name: 'words / normal', config: base, source: 'seeded' },
  { name: 'words / quote text', config: base, source: 'quote' },
  { name: 'time / normal', config: { ...base, mode: 'time' }, source: 'seeded' },
  { name: 'time / quote text', config: { ...base, mode: 'time' }, source: 'quote' },
  { name: 'words / expert', config: { ...base, difficulty: 'expert' }, source: 'seeded' },
  { name: 'words / master', config: { ...base, difficulty: 'master' }, source: 'seeded' },
  { name: 'words / nospace', config: { ...base, nospace: true }, source: 'seeded' },
  { name: 'quote / nospace', config: { ...base, nospace: true }, source: 'quote' },
  { name: 'words / freedomMode', config: { ...base, freedomMode: true }, source: 'seeded' },
  {
    name: 'words / stopOnError letter',
    config: { ...base, stopOnError: 'letter' },
    source: 'seeded'
  },
  { name: 'words / stopOnError word', config: { ...base, stopOnError: 'word' }, source: 'seeded' },
  { name: 'words / quickEnd', config: { ...base, quickEnd: true }, source: 'quote' },
  { name: 'time / minWpm 40', config: { ...base, mode: 'time', minWpm: 40 }, source: 'seeded' },
  { name: 'words / minWpm 90', config: { ...base, minWpm: 90 }, source: 'quote' },
  {
    name: 'match / go policy + minWpm',
    config: { ...base, mode: 'time', startPolicy: 'go', minWpm: 30 },
    source: 'seeded'
  },
  { name: 'free mode', config: { ...base, mode: 'free' }, source: 'seeded' }
]

/** Event-mix shapes. The perf fixture is `typing` only; the other two are the gap it leaves. */
type Shape = 'typing' | 'deletes' | 'replaces'
const SHAPES: readonly Shape[] = ['typing', 'deletes', 'replaces']

/**
 * A random event stream. Events are NOT filtered through a core first — the
 * differential is only interesting when both implementations get to reject the
 * same garbage, so invalid ranges, over-long words and post-finish events all
 * stay in.
 */
function randomEvents(
  rng: () => number,
  ctx: CoreContext,
  shape: Shape,
  steps: number
): GameEvent[] {
  const out: GameEvent[] = []
  // A cheap shadow of the buffer, only to bias characters toward the target.
  let wordIndex = 0
  let typed = 0
  let t = 0
  for (let seq = 1; seq <= steps; seq++) {
    t += Math.floor(rng() * 140)
    const roll = rng()
    const target = ctx.words[wordIndex] ?? ''
    const wantChar = target[typed] ?? 'q'
    const char = rng() < 0.8 ? wantChar : 'x'
    const deleteBias = shape === 'deletes' ? 0.45 : 0.12
    const replaceBias = shape === 'replaces' ? 0.35 : 0.05
    if (roll < deleteBias) {
      out.push(deleteEvent(seq, t, rng() < 0.65 ? 'char' : 'word'))
      typed = rng() < 0.65 ? Math.max(0, typed - 1) : 0
      if (typed === 0 && rng() < 0.3 && wordIndex > 0) wordIndex--
    } else if (roll < deleteBias + replaceBias) {
      const from = Math.floor(rng() * (typed + 2))
      const to = from + Math.floor(rng() * 3)
      const text = rng() < 0.5 ? wantChar : `${wantChar}${char}`
      out.push(replaceEvent(seq, t, from, to, text, rng() < 0.5 ? 'paste' : 'ime'))
      typed = Math.max(0, from + text.length)
    } else if (roll < deleteBias + replaceBias + 0.14) {
      out.push(commitEvent(seq, t))
      wordIndex++
      typed = 0
    } else {
      out.push(insertEvent(seq, t, char))
      typed++
    }
  }
  return out
}

/** Every derived read model, so a wrong incremental counter cannot hide. */
function readModels(ctx: CoreContext, state: GameState): readonly number[] {
  return [
    separatorsOf(ctx, state),
    netCharsOf(ctx, state),
    targetCharsOf(ctx, state),
    progressOf(ctx, state),
    minSpeedFailInstant(ctx, state) ?? -1
  ]
}

function legacyReadModels(ctx: CoreContext, state: GameState): readonly number[] {
  return [
    legacySeparatorsOf(ctx, state),
    legacyNetCharsOf(ctx, state),
    legacyTargetCharsOf(ctx, state),
    legacyProgressOf(ctx, state),
    legacyMinSpeedFailInstant(ctx, state) ?? -1
  ]
}

// ── The suite ────────────────────────────────────────────────────────────────

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34]

describe('differential: the B2 reducer reproduces the pre-B2 reducer exactly', () => {
  for (const variant of VARIANTS) {
    for (const shape of SHAPES) {
      it.each(SEEDS)(`${variant.name} / ${shape} logs (seed %i)`, (seed) => {
        const rng = mulberry32(seed * 7919 + shape.length)
        const words = wordsFor(variant.source, seed, 9)
        const ctx: CoreContext = { config: variant.config, words }
        const events = randomEvents(rng, ctx, shape, 140)

        // (1) Step by step: states, rejections and read models, all the way down.
        let mine: GameState = initialStateOf(ctx)
        let theirs: GameState = legacyInitialStateOf(ctx)
        expect(mine).toEqual(theirs)

        for (const event of events) {
          mine = settle(ctx, mine, event.t)
          theirs = legacySettle(ctx, theirs, event.t)
          expect(mine).toEqual(theirs)
          expect(readModels(ctx, mine)).toEqual(legacyReadModels(ctx, theirs))

          const a = reduce(ctx, mine, event)
          const b = legacyReduce(ctx, theirs, event)
          expect(a.isOk()).toBe(b.isOk())
          if (a.isErr() || b.isErr()) {
            expect(a._unsafeUnwrapErr()).toEqual(b._unsafeUnwrapErr())
            continue
          }
          mine = a._unsafeUnwrap()
          theirs = b._unsafeUnwrap()
          expect(mine).toEqual(theirs)
        }
        expect(readModels(ctx, mine)).toEqual(legacyReadModels(ctx, theirs))

        // (2) Batch: foldLog, including the abort seq of a rejected log.
        const folded = foldLog(ctx, events)
        const legacyFolded = legacyFoldLog(ctx, events)
        expect(folded.isOk()).toBe(legacyFolded.isOk())
        if (folded.isOk() && legacyFolded.isOk()) {
          expect(folded._unsafeUnwrap()).toEqual(legacyFolded._unsafeUnwrap())
        } else {
          expect(folded._unsafeUnwrapErr()).toEqual(legacyFolded._unsafeUnwrapErr())
        }

        // (3) The metrics layer over the same log: full objects, not spot checks.
        // `consistency` is the one deliberate delta: it was REDEFINED after the
        // oracle froze (per-second raw WPM through kogasa on [0, 1], mirroring
        // monkeytype, instead of per-word bursts on [0, 100]) — so it is compared
        // not against the oracle but against its own definition: the timeline's
        // raw series through `consistencyOf`, which also pins the bucket
        // equality between the metric and the chart on every randomised log.
        const endMs = asMs(events.length > 0 ? events[events.length - 1].t : 0)
        const metrics = computeMetrics(ctx, events, endMs)
        const { consistency: _legacy, ...legacyRest } = legacyComputeMetrics(ctx, events, endMs)
        const { consistency: mineConsistency, ...mineRest } = metrics
        expect(mineRest).toEqual(legacyRest)
        expect(mineConsistency).toBeGreaterThanOrEqual(0)
        expect(mineConsistency).toBeLessThanOrEqual(1)
        expect(mineConsistency).toBe(
          consistencyOf(wpmOverTime(ctx, events, endMs).map((p) => p.burst))
        )
        const timeline = wpmOverTime(ctx, events, endMs)
        expect(timeline).toEqual(legacyWpmOverTime(ctx, events, endMs))

        // (3b) THE ACCEPTANCE CRITERION of the three-series change, checked on
        // every one of these logs rather than on a chosen few: both cumulative
        // lines END on their own summary figure, and end on it EXACTLY.
        //
        // `toBe`, not `toBeCloseTo`. A tolerance here would hide the only bug
        // this can have: the chart and the header are computed from the same
        // credits over the same window, so they either agree bit for bit or
        // someone has re-derived one of them a second way — which is precisely
        // what `x / 60000` against `(x / 1000) / 60` was, silently wrong in the
        // last ulp for every run that did not last a whole number of seconds.
        //
        // A log that produced no timeline (no start instant, or a zero-length
        // window) is skipped rather than asserted: there is no last point to
        // compare, and the metrics for such a run are zero by their own guard.
        if (timeline.length > 0) {
          const last = timeline[timeline.length - 1]
          expect(last.wpm).toBe(metrics.wpm)
          expect(last.raw).toBe(metrics.raw)
        }
        expect(errorWords(ctx, events)).toEqual(legacyErrorWords(ctx, events))
      })
    }
  }
})

describe('differential: the two collapsed folds were replaceable, not merely similar', () => {
  const cases = VARIANTS.flatMap((variant) =>
    SHAPES.flatMap((shape) => SEEDS.map((seed) => ({ variant, shape, seed })))
  )

  it.each(cases.map((c) => [`${c.variant.name} / ${c.shape} / seed ${c.seed}`, c] as const))(
    'validateLog fold 3 and scoreV2 fold 4 — %s',
    (_label, { variant, shape, seed }) => {
      const rng = mulberry32(seed * 104_729 + shape.length)
      const words = wordsFor(variant.source, seed, 9)
      const ctx: CoreContext = { config: variant.config, words }
      const events = randomEvents(rng, ctx, shape, 140)
      const ordered = sortEvents(events)
      const lastT = asMs(ordered.length > 0 ? ordered[ordered.length - 1].t : 0)

      // Fold 3 — `afkOf` re-folded the whole log to recover two scalars that the
      // caller already holds. Same window in, same accounting out.
      const analysis = analyzeLog(ctx, events)
      const runEnd: Ms = analysis.finalState.finishedAt ?? lastT
      expect(afkBetween(events, analysis.finalState.startedAt, runEnd)).toEqual(
        legacyAfkOf(ctx, events, runEnd)
      )

      // Fold 4 — scoreV2OfLog ran a `foldLog` beside the metrics pass. `aborted`
      // marks exactly where that fold errored; otherwise settling the pass's final
      // state to the last event reproduces its result.
      const legacyFolded = legacyFoldLog(ctx, ordered)
      expect(analysis.aborted).toBe(legacyFolded.isErr())
      if (legacyFolded.isOk()) {
        expect(settle(ctx, analysis.finalState, lastT)).toEqual(legacyFolded._unsafeUnwrap())
      }
    }
  )
})

describe('the shared input buffer is invisible: states are snapshots, not views', () => {
  const ctx: CoreContext = { config: base, words: wordsFor('seeded', 11, 9) }

  it('a state held across a thousand later events still reads what it read', () => {
    const events = randomEvents(mulberry32(4242), ctx, 'typing', 1_000)
    const held: GameState[] = []
    const snapshots: string[] = []
    let state = initialStateOf(ctx)
    for (const event of events) {
      state = settle(ctx, state, event.t)
      const next = reduce(ctx, state, event)
      if (next.isErr()) continue
      state = next._unsafeUnwrap()
      if (held.length < 40 && event.seq % 25 === 0) {
        held.push(state)
        snapshots.push(JSON.stringify(state))
      }
    }
    // Read AFTER the whole log has been folded past them, in reverse, so the
    // buffer has to seek both directions.
    for (let i = held.length - 1; i >= 0; i--) {
      expect(JSON.stringify(held[i])).toBe(snapshots[i])
    }
    for (let i = 0; i < held.length; i++) {
      expect(JSON.stringify(held[i])).toBe(snapshots[i])
    }
  })

  it('branching off a held state does not disturb the branch it was taken from', () => {
    const log = [
      insertEvent(1, 0, ctx.words[0][0]),
      insertEvent(2, 40, ctx.words[0][1] ?? 'x'),
      commitEvent(3, 80),
      insertEvent(4, 120, ctx.words[1][0])
    ]
    let trunk = initialStateOf(ctx)
    const forkPoint: GameState[] = []
    for (const event of log) {
      trunk = reduce(ctx, trunk, event)._unsafeUnwrap()
      forkPoint.push(trunk)
    }
    const trunkInputs = forkPoint.map((state) => [...state.input])

    // Re-run three different continuations from the SAME held state.
    const branchAt = forkPoint[1]
    for (const text of ['a', 'bb', 'ccc']) {
      const branch = reduce(ctx, branchAt, insertEvent(9, 500, text))
      if (branch.isErr()) continue
      expect(branch._unsafeUnwrap().input[0]).toBe(`${branchAt.input[0]}${text}`)
    }
    expect(forkPoint.map((state) => [...state.input])).toEqual(trunkInputs)
  })

  it('a plain object literal state (a serialization round trip) still reduces', () => {
    const folded = foldLog(ctx, [
      insertEvent(1, 0, ctx.words[0][0]),
      insertEvent(2, 40, ctx.words[0][1] ?? 'x')
    ])._unsafeUnwrap()
    const plain: GameState = JSON.parse(JSON.stringify(folded)) as GameState
    expect(plain).toEqual(folded)
    const viaPlain = reduce(ctx, plain, insertEvent(3, 80, 'z'))._unsafeUnwrap()
    const viaCore = reduce(ctx, folded, insertEvent(3, 80, 'z'))._unsafeUnwrap()
    expect(viaPlain).toEqual(viaCore)
    expect(readModels(ctx, viaPlain)).toEqual(readModels(ctx, viaCore))
  })
})

describe('the differential fixtures are not vacuous', () => {
  it('quote targets carry the newline that `endsLine` keys on', () => {
    const quoted = wordsFor('quote', 3, 9)
    expect(quoted.length).toBeGreaterThan(3)
    expect(quoted.some((word) => word.endsWith('\n'))).toBe(true)
    expect(quoted.some((word) => !word.endsWith('\n'))).toBe(true)
  })

  it('seeded targets are real words', () => {
    const seeded = wordsFor('seeded', 3, 9)
    expect(seeded).toHaveLength(9)
    expect(seeded.every((word) => word.length > 0)).toBe(true)
  })

  it('each shape commits words, edits and gets rejected', () => {
    const ctx: CoreContext = { config: base, words: wordsFor('seeded', 1, 9) }
    for (const shape of SHAPES) {
      const events = randomEvents(mulberry32(7919 + shape.length), ctx, shape, 140)
      const kinds = new Set(events.map((event) => event.kind))
      expect(kinds.has('insert')).toBe(true)
      expect(kinds.has(shape === 'replaces' ? 'replace' : 'delete')).toBe(true)

      let state = initialStateOf(ctx)
      let accepted = 0
      let rejected = 0
      for (const event of events) {
        state = settle(ctx, state, event.t)
        const next = reduce(ctx, state, event)
        if (next.isErr()) rejected++
        else {
          accepted++
          state = next._unsafeUnwrap()
        }
      }
      // Both branches of the diff are exercised: real progress AND real refusals.
      expect(accepted).toBeGreaterThan(20)
      expect(rejected + (state.phase === 'finished' ? 1 : 0)).toBeGreaterThan(0)
      expect(state.wordIndex).toBeGreaterThan(0)
    }
  })
})
