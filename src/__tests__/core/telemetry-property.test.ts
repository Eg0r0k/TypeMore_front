/**
 * The stripping property, randomized — `fast-check` over arbitrary input.
 *
 * `telemetry.test.ts` pins the same property on five hand-written scenarios, and
 * it synthesizes BOTH twins from one generator inside the test: a bug in that
 * generator moves the two logs together and the assertion proves nothing. This
 * file removes both weaknesses.
 *
 *  - The input is an arbitrary keystroke PROGRAM (`fast-check`): correct and
 *    mistyped characters, commits, backspaces, dead modifier presses, shifted
 *    keys whose holds overlap the key they modify, and arbitrary gap/lead/hold
 *    timings around each one.
 *  - Neither log is written by this file. The program is played twice through
 *    the REAL producer — `useGameStore`, the same store the typing page drives —
 *    once armed for log v1 and once for log v2. The only difference between the
 *    two runs is the `logVersion` handed to `setup()`; every `keyDown`/`keyUp`
 *    call is made on both. What the v1 store does with them (drop them) is the
 *    behaviour under test, not something the test simulates.
 *
 * Both runs are pinned to ONE time base with the match start policy (`go` +
 * `start(0)`). Under the default lazy policy each producer anchors `t = 0` on
 * its own first event, and a v2 log's first event is a key-down that precedes
 * the first insert — the two logs would then be a constant shift apart and
 * "bit-identical" would be meaningless. Pinning the anchor is the one thing the
 * production store already offers for exactly that reason (it is how a match
 * anchors every seat on the server's go instant).
 *
 * What is asserted, per generated program:
 *   1. stripping the v2 log and renumbering `seq` contiguously yields the v1
 *      log EVENT FOR EVENT (kind, seq, t, payload) — the state stream the v1
 *      producer wrote is byte-for-byte inside the v2 one;
 *   2. folding the v2 log equals folding it stripped, `lastSeq` included —
 *      telemetry never touched the state object;
 *   3. metrics, scoreV1 and scoreV2 of the v2 log equal those of the v1 log;
 *   4. `validateLog` returns the same report for both;
 *   5. the two LIVE stores agree — same phase/input/metrics/score at the end,
 *      differing only in `lastSeq`, which counts the seq telemetry consumed.
 */
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type CoreContext,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GameState,
  type GenerationConfig,
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  asSeq,
  computeMetrics,
  dictVersion,
  foldLog,
  generateWords,
  isTelemetryEvent,
  makeSeedContext,
  scoreOfLog,
  scoreV2OfLog,
  validateLog
} from '@shared/core'
import { releaseGameStore, useGameStore } from '@entities/game'

const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: [
    'alpha',
    'bravo',
    'charlie',
    'delta',
    'echo',
    'foxtrot',
    'golf',
    'hotel',
    'india',
    'juliet',
    'kilo',
    'lima'
  ]
}

const NO_DECLARATION = { blind: false, fading: false, flashlight: false } as const

// ── The generated program ────────────────────────────────────────────────────

/** One physical key press. `lead`/`hold` place its effect and its release. */
interface Stroke {
  /** What the key does to the text, if anything. */
  readonly effect: 'correct' | 'typo' | 'commit' | 'backspace' | 'none'
  /** Idle before the key goes down (ms). */
  readonly gap: number
  /** Key-down → the effect it produces (ms). */
  readonly lead: number
  /** The effect → key-up (ms). */
  readonly hold: number
  /** Wrap the press in a Shift hold, so two holds overlap on the wire. */
  readonly shift: boolean
  /** Chooses the physical `code` reported for a press that types nothing. */
  readonly deadKey: number
}

/** Physical keys a dead press may report — all pairable, none of them typing. */
const DEAD_CODES = ['ControlLeft', 'AltLeft', 'MetaLeft', 'CapsLock', 'F5'] as const

const strokeArb = (allowCommit: boolean): fc.Arbitrary<Stroke> =>
  fc.record({
    effect: fc.constantFrom(
      ...(['correct', 'correct', 'correct', 'typo', 'backspace', 'none'] as const),
      ...(allowCommit ? (['commit', 'commit'] as const) : [])
    ),
    // Bounded so a whole program stays inside the timed scenario's deadline
    // (80 strokes × 630ms < 60s); see the durationMs below.
    gap: fc.integer({ min: 5, max: 400 }),
    lead: fc.integer({ min: 0, max: 30 }),
    hold: fc.integer({ min: 5, max: 200 }),
    shift: fc.boolean(),
    deadKey: fc.integer({ min: 0, max: DEAD_CODES.length - 1 })
  })

interface Scenario {
  readonly name: string
  readonly config: CoreConfig
  readonly generation: GenerationConfig
}

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  // Pinned anchor: both producers stamp against the same t = 0 (see the header).
  startPolicy: 'go',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 6,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const scenarios: readonly Scenario[] = [
  { name: 'words / seeded', config: coreCfg(), generation: gen() },
  {
    name: 'time / seeded',
    config: coreCfg({ mode: 'time' }),
    generation: gen({ mode: 'time' })
  },
  { name: 'words / nospace', config: coreCfg({ nospace: true }), generation: gen() },
  {
    name: 'words / randomCase + reverse',
    config: coreCfg(),
    generation: gen({ randomCase: true, reverse: true })
  },
  {
    name: 'words / expert difficulty',
    config: coreCfg({ difficulty: 'expert' }),
    generation: gen({ punctuation: true })
  }
]

interface Program {
  readonly scenario: number
  readonly seed: number
  readonly strokes: readonly Stroke[]
}

const programArb: fc.Arbitrary<Program> = fc
  .record({
    scenario: fc.integer({ min: 0, max: scenarios.length - 1 }),
    seed: fc.integer({ min: 0, max: 4_294_967_295 })
  })
  .chain((head) =>
    fc
      // `size: 'max'` on purpose: fast-check's default sizing draws mostly
      // 0-10-element arrays, and a five-keystroke run exercises none of the
      // commit/backspace/finish machinery this property is about.
      .array(strokeArb(!scenarios[head.scenario].config.nospace), {
        minLength: 10,
        maxLength: 80,
        size: 'max'
      })
      .map((strokes) => ({ ...head, strokes }))
  )

// ── Playing a program through the real store ─────────────────────────────────

type Store = ReturnType<typeof useGameStore>

/**
 * The character a `correct` stroke types, read off the LIVE run — so a program
 * really does advance through the text instead of typing noise at it. `typo`
 * answers with a character the target is not.
 */
function charFor(store: Store, effect: 'correct' | 'typo'): string {
  const words = store.words
  const target = words[store.wordIndex] ?? ''
  const typed = store.snapshot.input[store.wordIndex] ?? ''
  const expected = [...target][[...typed].length] ?? 'z'
  if (effect === 'correct') return expected
  return expected === 'q' ? 'w' : 'q'
}

/** `KeyboardEvent.code` for a character — physical-key shaped, never the glyph. */
const codeFor = (char: string): string => {
  const upper = char.toUpperCase()
  return /^[A-Z]$/.test(upper) ? `Key${upper}` : 'Digit1'
}

/**
 * Play one program through both stores, step for step. The character a stroke
 * types is resolved from the V1 store and handed to both, so the two runs are
 * driven by literally the same text — the only asymmetry left is the telemetry
 * the v2 store is armed to keep.
 */
function play(v1: Store, v2: Store, program: Program, setClock: (ms: number) => void): void {
  let clock = 0
  for (const stroke of program.strokes) {
    clock += stroke.gap
    const shiftCode = 'ShiftLeft'
    if (stroke.shift) {
      setClock(clock)
      v1.keyDown(shiftCode)
      v2.keyDown(shiftCode)
      clock += 1
    }

    const text =
      stroke.effect === 'correct' || stroke.effect === 'typo' ? charFor(v1, stroke.effect) : ''
    const code =
      stroke.effect === 'commit'
        ? 'Space'
        : stroke.effect === 'backspace'
          ? 'Backspace'
          : stroke.effect === 'none'
            ? DEAD_CODES[stroke.deadKey]
            : codeFor(text)

    setClock(clock)
    v1.keyDown(code)
    v2.keyDown(code)

    clock += stroke.lead
    setClock(clock)
    switch (stroke.effect) {
      case 'correct':
      case 'typo':
        v1.insert(text)
        v2.insert(text)
        break
      case 'commit':
        v1.commit()
        v2.commit()
        break
      case 'backspace':
        v1.deleteBackward('char')
        v2.deleteBackward('char')
        break
      case 'none':
        break
    }

    clock += stroke.hold
    setClock(clock)
    v1.keyUp(code)
    v2.keyUp(code)
    if (stroke.shift) {
      clock += 1
      setClock(clock)
      v1.keyUp(shiftCode)
      v2.keyUp(shiftCode)
    }
  }
}

// ── Helpers over a captured log ──────────────────────────────────────────────

const strip = (events: readonly GameEvent[]): readonly GameEvent[] =>
  events.filter((e) => !isTelemetryEvent(e))

/** Strip AND renumber contiguously: the log a v1 producer wrote for this run. */
const asV1Twin = (events: readonly GameEvent[]): readonly GameEvent[] =>
  strip(events).map((e, i) => ({ ...e, seq: asSeq(i + 1) }))

/** Everything about a fold except the seq counter telemetry also consumes. */
const withoutSeq = (state: GameState): Omit<GameState, 'lastSeq'> => {
  const { lastSeq: _lastSeq, ...rest } = state
  return rest
}

// ── The property ─────────────────────────────────────────────────────────────

describe('the stripping property, over arbitrary input (fast-check)', () => {
  let clock = 0

  beforeEach(() => {
    setActivePinia(createPinia())
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })

  afterEach(() => {
    releaseGameStore('prop-v1')
    releaseGameStore('prop-v2')
    vi.restoreAllMocks()
  })

  it('v2 minus telemetry is the v1 capture of the same keystrokes, bit for bit', () => {
    // Anti-vacuity ledger: a property that only ever saw empty logs would pass
    // every assertion below. Asserted after the run, not inside it.
    const seen = { runs: 0, events: 0, telemetry: 0, finished: 0, rejected: 0, flagged: 0 }

    fc.assert(
      fc.property(programArb, (program) => {
        const scenario = scenarios[program.scenario]
        const words = generateWords(
          dict,
          makeSeedContext(dict, program.seed, scenario.generation)
        )._unsafeUnwrap().words

        const v1 = useGameStore('prop-v1')
        const v2 = useGameStore('prop-v2')
        const setup = { config: scenario.config, words, generation: scenario.generation }
        v1.setup({ ...setup, logVersion: EVENT_LOG_VERSION })
        v2.setup({ ...setup, logVersion: EVENT_LOG_VERSION_TELEMETRY })
        clock = 0
        v1.start(0)
        v2.start(0)

        play(v1, v2, program, (ms) => {
          clock = ms
        })

        const logV1 = v1.getReplayData()?.log ?? []
        const logV2 = v2.getReplayData()?.log ?? []
        const ctx: CoreContext = { config: scenario.config, words }

        // The v1 producer is what it claims to be: no telemetry ever reached it.
        expect(logV1.some(isTelemetryEvent)).toBe(false)

        // (1) The state stream inside the v2 log IS the v1 log.
        expect(asV1Twin(logV2)).toEqual(logV1)
        // Both logs are contiguous in their own numbering.
        expect(logV2.map((e) => e.seq)).toEqual(logV2.map((_e, i) => i + 1))
        expect(logV1.map((e) => e.seq)).toEqual(logV1.map((_e, i) => i + 1))

        // (2) Telemetry is invisible to the fold — `lastSeq` included, because
        // the reducer hands the same state object back for a down/up.
        const bare = strip(logV2)
        const foldedV2 = foldLog(ctx, logV2)._unsafeUnwrap()
        const foldedBare = foldLog(ctx, bare)._unsafeUnwrap()
        expect(foldedV2).toEqual(foldedBare)
        expect(foldedV2.lastSeq).toBe(foldedBare.lastSeq)

        // …and invisible to the fold of the renumbered v1 twin apart from that
        // one counter, which the v1 producer never advanced for a key press.
        const foldedV1 = foldLog(ctx, logV1)._unsafeUnwrap()
        expect(withoutSeq(foldedV2)).toEqual(withoutSeq(foldedV1))

        // (3) Every measured quantity agrees across the twins.
        const end = foldedV1.finishedAt ?? (logV1.length > 0 ? logV1[logV1.length - 1].t : 0)
        expect(computeMetrics(ctx, logV2, end)).toEqual(computeMetrics(ctx, logV1, end))
        expect(scoreOfLog(logV2, ctx)).toEqual(scoreOfLog(logV1, ctx))
        const scoreCtx = { ...ctx, generation: scenario.generation }
        expect(scoreV2OfLog(logV2, scoreCtx, NO_DECLARATION)).toEqual(
          scoreV2OfLog(logV1, scoreCtx, NO_DECLARATION)
        )

        // (4) The judgement is the same judgement.
        const snapshot: ConfigSnapshot = {
          config: scenario.config,
          generation: scenario.generation
        }
        const asLog = (events: readonly GameEvent[], version: 1 | 2): EventLog => ({
          version: version === 1 ? EVENT_LOG_VERSION : EVENT_LOG_VERSION_TELEMETRY,
          events
        })
        const reportV1 = validateLog({
          seed: program.seed,
          dictionary: dict,
          dictVersion: dictVersion(dict.words),
          configSnapshot: snapshot,
          log: asLog(logV1, 1)
        })._unsafeUnwrap()
        const reportV2 = validateLog({
          seed: program.seed,
          dictionary: dict,
          dictVersion: dictVersion(dict.words),
          configSnapshot: snapshot,
          log: asLog(logV2, 2)
        })._unsafeUnwrap()
        expect(reportV2).toEqual(reportV1)

        seen.runs += 1
        seen.events += logV1.length
        seen.telemetry += logV2.length - logV1.length
        if (foldedV1.phase === 'finished') seen.finished += 1
        // A program is free to aim events the reducer refuses (a backspace into
        // a committed word, an insert past the extra-char cap): those never
        // enter the log, and the seq they took is handed back.
        if (logV2.length < program.strokes.length) seen.rejected += 1
        if (reportV1.flags.length > 0) seen.flagged += 1

        // (5) The two LIVE stores are the same run on screen.
        expect(withoutSeq(v2.snapshot)).toEqual(withoutSeq(v1.snapshot))
        expect(v2.metrics).toEqual(v1.metrics)
        expect(v2.scoreResult).toEqual(v1.scoreResult)
        expect(v2.score).toBe(v1.score)
        expect(v2.comboPeak).toBe(v1.comboPeak)
      }),
      // A fixed seed keeps CI deterministic while still covering 200 unrelated
      // programs; bump it to explore a different slice of the space.
      { numRuns: 200, seed: 0x7e1e }
    )

    expect(seen.runs).toBe(200)
    // The corpus is a real corpus: thousands of state events, telemetry around
    // every one of them, runs that reached `finished`, events the reducer threw
    // away, and reports that carried plausibility flags.
    expect(seen.events).toBeGreaterThan(3000)
    expect(seen.telemetry).toBeGreaterThan(seen.events)
    expect(seen.finished).toBeGreaterThan(0)
    expect(seen.rejected).toBeGreaterThan(0)
    expect(seen.flagged).toBeGreaterThan(0)
  })

  it('the v2 log really does carry telemetry (the property is not vacuous)', () => {
    const scenario = scenarios[0]
    const words = generateWords(dict, makeSeedContext(dict, 7, scenario.generation))._unsafeUnwrap()
      .words
    const v1 = useGameStore('prop-v1')
    const v2 = useGameStore('prop-v2')
    const setup = { config: scenario.config, words, generation: scenario.generation }
    v1.setup({ ...setup, logVersion: EVENT_LOG_VERSION })
    v2.setup({ ...setup, logVersion: EVENT_LOG_VERSION_TELEMETRY })
    clock = 0
    v1.start(0)
    v2.start(0)

    play(
      v1,
      v2,
      {
        scenario: 0,
        seed: 7,
        strokes: Array.from({ length: 12 }, () => ({
          effect: 'correct' as const,
          gap: 80,
          lead: 2,
          hold: 40,
          shift: false,
          deadKey: 0
        }))
      },
      (ms) => {
        clock = ms
      }
    )

    const logV2 = v2.getReplayData()?.log ?? []
    expect(logV2.filter(isTelemetryEvent).length).toBeGreaterThan(0)
    expect(logV2.length).toBeGreaterThan((v1.getReplayData()?.log ?? []).length)
  })
})

/**
 * The same twins under the DEFAULT (lazy) anchor — the configuration the app
 * actually ships.
 *
 * The suite above pins both producers to one time base (`go` + `start(0)`) so
 * that `t` itself can be compared byte for byte. That is a real production path
 * (a match seat anchors on the server's go instant), but it is not the common
 * one: a solo run — and the race host, which forces `startPolicy: 'input'`
 * (`features/test/race/ui.vue:147`) — anchors lazily, on the log's own first
 * event. For a v2 log that first event is a key-down standing BEFORE the first
 * insert, so the two clients' state events come out a constant apart.
 *
 * Validation already survives that: `validate.ts:207` anchors the solo deadline
 * on the first STATE event, not the first event. Nothing, until now, checked
 * what the SHIFT does to the numbers a player is shown and scored on.
 *
 * So this property allows the shift in raw `t` — and asserts it is a single
 * uniform constant, which is the honest statement of what the anchor does — but
 * holds every COUNTED quantity to exact equality: scoreV1, scoreV2, wpm, raw,
 * accuracy, chars, spaces, measured off each log at its OWN end instant, both
 * from the pure functions and from the live stores the results screen reads.
 */
describe('the counted quantities under the default lazy anchor', () => {
  let clock = 0

  beforeEach(() => {
    setActivePinia(createPinia())
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })

  afterEach(() => {
    releaseGameStore('lazy-v1')
    releaseGameStore('lazy-v2')
    vi.restoreAllMocks()
  })

  it('v2 scores and measures exactly like v1 on the same input, shift and all', () => {
    // Anti-vacuity ledger: if the anchors never actually diverged, this suite
    // would be the `go` suite with extra steps.
    const seen = { runs: 0, shifted: 0, maxShift: 0, events: 0, finished: 0 }

    fc.assert(
      fc.property(programArb, (program) => {
        const scenario = scenarios[program.scenario]
        // The one difference from the suite above: no pinned anchor, no
        // `start()` — `stamp()` claims t = 0 on whichever event lands first.
        const config: CoreConfig = { ...scenario.config, startPolicy: 'input' }
        const words = generateWords(
          dict,
          makeSeedContext(dict, program.seed, scenario.generation)
        )._unsafeUnwrap().words

        const v1 = useGameStore('lazy-v1')
        const v2 = useGameStore('lazy-v2')
        const setup = { config, words, generation: scenario.generation }
        v1.setup({ ...setup, logVersion: EVENT_LOG_VERSION })
        v2.setup({ ...setup, logVersion: EVENT_LOG_VERSION_TELEMETRY })
        clock = 0

        play(v1, v2, program, (ms) => {
          clock = ms
        })

        const logV1 = v1.getReplayData()?.log ?? []
        const logV2 = v2.getReplayData()?.log ?? []
        const stateV2 = strip(logV2)
        if (logV1.length === 0) return
        const ctx: CoreContext = { config, words }

        // The shift is expected — and it is ONE number, not per-event drift.
        // (A non-uniform shift would mean the two producers disagreed about
        // more than where zero is, which no assertion below would catch.)
        const shift = stateV2[0].t - logV1[0].t
        expect(shift).toBeGreaterThanOrEqual(0)
        expect(stateV2.map((e) => e.t - shift)).toEqual(logV1.map((e) => e.t))
        expect(logV1[0].t).toBe(0) // v1 anchors on its first insert…
        expect(logV2[0].t).toBe(0) // …v2 on the key-down that produced it

        // Each log is measured at ITS OWN end, exactly as production does.
        const foldedV1 = foldLog(ctx, logV1)._unsafeUnwrap()
        const foldedV2 = foldLog(ctx, logV2)._unsafeUnwrap()
        const endV1 = foldedV1.finishedAt ?? logV1[logV1.length - 1].t
        const endV2 = foldedV2.finishedAt ?? stateV2[stateV2.length - 1].t
        const metricsV1 = computeMetrics(ctx, logV1, endV1)
        const metricsV2 = computeMetrics(ctx, logV2, endV2)

        expect(metricsV2.wpm).toBe(metricsV1.wpm)
        expect(metricsV2.raw).toBe(metricsV1.raw)
        expect(metricsV2.accuracy).toBe(metricsV1.accuracy)
        expect(metricsV2.chars).toEqual(metricsV1.chars)
        expect(metricsV2.spaces).toBe(metricsV1.spaces)
        // Nothing else in the metrics object moved either.
        expect(metricsV2).toEqual(metricsV1)

        expect(scoreOfLog(logV2, ctx)).toEqual(scoreOfLog(logV1, ctx))
        const scoreCtx = { ...ctx, generation: scenario.generation }
        expect(scoreV2OfLog(logV2, scoreCtx, NO_DECLARATION)).toEqual(
          scoreV2OfLog(logV1, scoreCtx, NO_DECLARATION)
        )

        // The live stores — the exact objects the HUD and the results screen
        // read, measured on their own clocks, not on a `computeMetrics` the
        // test chose the end instant for.
        expect(v2.metrics).toEqual(v1.metrics)
        expect(v2.scoreResult).toEqual(v1.scoreResult)
        expect(v2.score).toBe(v1.score)
        expect(v2.comboPeak).toBe(v1.comboPeak)

        seen.runs += 1
        seen.events += logV1.length
        if (shift > 0) seen.shifted += 1
        seen.maxShift = Math.max(seen.maxShift, shift)
        if (foldedV1.phase === 'finished') seen.finished += 1
      }),
      { numRuns: 200, seed: 0x1a2e }
    )

    expect(seen.events).toBeGreaterThan(3000)
    expect(seen.finished).toBeGreaterThan(0)
    // The anchors really did diverge, in most programs and by a real amount.
    expect(seen.shifted).toBeGreaterThan(seen.runs / 2)
    expect(seen.maxShift).toBeGreaterThan(0)
  })
})
