import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type CoreContext,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  type PlausibilityThresholds,
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  asSeq,
  commitEvent,
  computeMetrics,
  dictVersion,
  foldLog,
  generateWords,
  initialStateOf,
  insertEvent,
  isTelemetryEvent,
  keyDownEvent,
  keyUpEvent,
  makeSeedContext,
  parseEventBatch,
  parseGameEvent,
  reduce,
  scoreOfLog,
  scoreV2OfLog,
  validateLog
} from '@shared/core'

/**
 * Log v2 keystroke telemetry (`down` / `up`).
 *
 * The load-bearing property of the whole feature is that telemetry is
 * INVISIBLE to state, metrics, score and verdict: for any v2 log, stripping
 * every `down`/`up` yields a bit-identical fold state (`lastSeq` included —
 * telemetry never touches the state object), identical metrics, an identical
 * score, and the same validateLog report as the run captured by a v1 client
 * (the stripped events renumbered contiguously — which is exactly the log a
 * v1 producer would have written for the same keystrokes).
 */

const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
}

const QUOTE_TEXT = 'the quick brown fox'

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 4,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const wordsFor = (seed: number, g: GenerationConfig): readonly string[] =>
  generateWords(dict, makeSeedContext(dict, seed, g))._unsafeUnwrap().words

/**
 * Type every word correctly as a V1 log (human-ish jitter), optionally
 * interleaving telemetry around every insert: `down` 8ms before it, `up` 25ms
 * after — the DOM ordering the input adapter produces. Returns both twins:
 * the v1 capture and the v2 capture of the SAME keystrokes (state events at
 * the same `t`, seq renumbered per producer).
 */
function typeAllTwins(
  words: readonly string[],
  opts: { nospace?: boolean } = {}
): { v1: EventLog; v2: EventLog } {
  interface Stroke {
    readonly kind: 'insert' | 'commit'
    readonly t: number
    readonly text?: string
  }
  const strokes: Stroke[] = []
  let t = 100
  let i = 0
  for (const word of words) {
    for (const ch of word) {
      strokes.push({ kind: 'insert', t, text: ch })
      t += 80 + (i++ % 6) * 12
    }
    if (!opts.nospace) {
      strokes.push({ kind: 'commit', t })
      // Advance past the commit too: the NEXT stroke's `down` fires 8ms before
      // its instant, and must not land before this stroke's `up` (+25ms).
      t += 90
    }
  }

  let seq1 = 1
  const v1Events: GameEvent[] = strokes.map((s) =>
    s.kind === 'insert' ? insertEvent(seq1++, s.t, s.text!) : commitEvent(seq1++, s.t)
  )

  let seq2 = 1
  const v2Events: GameEvent[] = []
  for (const s of strokes) {
    if (s.kind === 'insert') {
      v2Events.push(keyDownEvent(seq2++, s.t - 8, `Key${s.text!.toUpperCase()[0]}`))
      v2Events.push(insertEvent(seq2++, s.t, s.text!))
      v2Events.push(keyUpEvent(seq2++, s.t + 25, `Key${s.text!.toUpperCase()[0]}`))
    } else {
      v2Events.push(keyDownEvent(seq2++, s.t - 8, 'Space'))
      v2Events.push(commitEvent(seq2++, s.t))
      v2Events.push(keyUpEvent(seq2++, s.t + 25, 'Space'))
    }
  }
  // t must stay monotonic after interleaving: the down of stroke N+1 must not
  // precede the up of stroke N. Interval floor is 80ms, offsets are -8/+25.
  return {
    v1: { version: EVENT_LOG_VERSION, events: v1Events },
    v2: { version: EVENT_LOG_VERSION_TELEMETRY, events: v2Events }
  }
}

/** Strip telemetry, KEEPING the original seq numbers (fold-level twin). */
const stripped = (log: EventLog): readonly GameEvent[] =>
  log.events.filter((e) => !isTelemetryEvent(e))

const validate = (
  seed: number,
  log: EventLog,
  snap: ConfigSnapshot,
  thresholds?: Partial<PlausibilityThresholds>
) =>
  validateLog({
    seed,
    dictionary: dict,
    // A quote run's claimed dictVersion is the TEXT's fingerprint, a seeded
    // run's is the dictionary's — mirror what a real submitter sends.
    dictVersion:
      snap.generation.textSource?.kind === 'quote'
        ? dictVersion([snap.generation.textSource.text])
        : dictVersion(dict.words),
    configSnapshot: snap,
    log,
    thresholds
  })

// ── The stripping property, across modes and mods ────────────────────────────

interface Scenario {
  readonly name: string
  readonly config: CoreConfig
  readonly generation: GenerationConfig
  readonly nospace?: boolean
}

const scenarios: Scenario[] = [
  { name: 'words / seeded', config: coreCfg(), generation: gen() },
  {
    name: 'time / seeded',
    config: coreCfg({ mode: 'time', durationMs: 60_000 }),
    generation: gen({ mode: 'time' })
  },
  {
    name: 'words / nospace',
    config: coreCfg({ nospace: true }),
    generation: gen(),
    nospace: true
  },
  {
    name: 'words / randomCase + reverse',
    config: coreCfg(),
    generation: gen({ randomCase: true, reverse: true })
  },
  {
    name: 'quote text source',
    config: coreCfg({ mode: 'words' }),
    generation: gen({
      mode: 'quote',
      length: 0,
      textSource: {
        kind: 'quote',
        quoteId: '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e',
        quoteHash: dictVersion([QUOTE_TEXT]),
        text: QUOTE_TEXT
      }
    })
  }
]

describe('the stripping property: telemetry is invisible', () => {
  for (const s of scenarios) {
    // In time mode the generated buffer outlasts the 60s window at this typing
    // cadence — type a prefix and leave the run honestly unfinished; every
    // compared quantity is still exercised.
    const typedSlice = (words: readonly string[]): readonly string[] =>
      s.config.mode === 'time' ? words.slice(0, 3) : words

    it(`${s.name}: fold state, metrics and score are bit-identical`, () => {
      const words = wordsFor(7, s.generation)
      const ctx: CoreContext = { config: s.config, words }
      const { v2 } = typeAllTwins(typedSlice(words), { nospace: s.nospace })
      const bare = stripped(v2)

      const foldedV2 = foldLog(ctx, v2.events)._unsafeUnwrap()
      const foldedBare = foldLog(ctx, bare)._unsafeUnwrap()
      expect(foldedV2).toEqual(foldedBare)
      // Not just equal — `lastSeq` included, because telemetry never wrote it.
      expect(foldedV2.lastSeq).toBe(foldedBare.lastSeq)

      const end = foldedV2.finishedAt ?? v2.events[v2.events.length - 1].t
      expect(computeMetrics(ctx, v2.events, end)).toEqual(computeMetrics(ctx, bare, end))
      expect(scoreOfLog(v2.events, ctx)).toEqual(scoreOfLog(bare, ctx))
      expect(
        scoreV2OfLog(
          v2.events,
          { ...ctx, generation: s.generation },
          {
            blind: false,
            fading: false,
            flashlight: false
          }
        )
      ).toEqual(
        scoreV2OfLog(
          bare,
          { ...ctx, generation: s.generation },
          {
            blind: false,
            fading: false,
            flashlight: false
          }
        )
      )
    })

    it(`${s.name}: the v2 log judges exactly like its v1-captured twin`, () => {
      const { v1, v2 } = typeAllTwins(typedSlice(wordsFor(7, s.generation)), {
        nospace: s.nospace
      })
      const snap: ConfigSnapshot = { config: s.config, generation: s.generation }
      const reportV2 = validate(7, v2, snap)._unsafeUnwrap()
      const reportV1 = validate(7, v1, snap)._unsafeUnwrap()
      expect(reportV2).toEqual(reportV1)
      expect(reportV2.verdict).toBe('valid')
    })
  }
})

// ── Reducer: telemetry is a state no-op in every phase ───────────────────────

describe('reduce and telemetry', () => {
  const ctx: CoreContext = { config: coreCfg(), words: ['ab'] }

  it('returns the SAME state object, untouched', () => {
    const state = initialStateOf(ctx)
    const next = reduce(ctx, state, keyDownEvent(1, 0, 'KeyA'))._unsafeUnwrap()
    expect(next).toBe(state)
  })

  it('is legal after the run finished (the final key release)', () => {
    let state = initialStateOf(ctx)
    state = reduce(ctx, state, insertEvent(1, 0, 'a'))._unsafeUnwrap()
    state = reduce(ctx, state, insertEvent(2, 100, 'b'))._unsafeUnwrap()
    state = reduce(ctx, state, commitEvent(3, 180))._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    // An insert after finish is rejected; the trailing key release is not.
    expect(reduce(ctx, state, insertEvent(4, 250, 'x')).isErr()).toBe(true)
    const after = reduce(ctx, state, keyUpEvent(4, 250, 'Space'))._unsafeUnwrap()
    expect(after).toBe(state)
  })

  it('still respects seq monotonicity against state events', () => {
    let state = initialStateOf(ctx)
    state = reduce(ctx, state, insertEvent(5, 0, 'a'))._unsafeUnwrap()
    expect(reduce(ctx, state, keyDownEvent(5, 10, 'KeyB')).isErr()).toBe(true)
    expect(reduce(ctx, state, keyDownEvent(4, 10, 'KeyB')).isErr()).toBe(true)
    expect(reduce(ctx, state, keyDownEvent(6, 10, 'KeyB')).isOk()).toBe(true)
  })
})

// ── parse: the v2 grammar ────────────────────────────────────────────────────

describe('parseGameEvent / parseEventBatch and log versions', () => {
  const down = { kind: 'down', seq: 1, t: 0, code: 'KeyF' }

  it('v1 grammar is unchanged: down/up are unknown kinds', () => {
    expect(parseGameEvent(down)._unsafeUnwrapErr().code).toBe('bad-kind')
    expect(parseGameEvent(down, EVENT_LOG_VERSION)._unsafeUnwrapErr().code).toBe('bad-kind')
  })

  it('v2 admits down/up with a strict code shape', () => {
    const parsed = parseGameEvent(down, EVENT_LOG_VERSION_TELEMETRY)._unsafeUnwrap()
    expect(parsed).toEqual(keyDownEvent(1, 0, 'KeyF'))
    const up = parseGameEvent(
      { kind: 'up', seq: 2, t: 30, code: 'ShiftLeft' },
      EVENT_LOG_VERSION_TELEMETRY
    )._unsafeUnwrap()
    expect(up).toEqual(keyUpEvent(2, 30, 'ShiftLeft'))
  })

  it.each([
    ['empty', ''],
    ['too long', 'A'.repeat(33)],
    ['character leakage', 'ф'],
    ['punctuation', 'Key-F'],
    ['space', 'Key F'],
    ['non-string', 7]
  ])('rejects a bad code shape: %s', (_name, code) => {
    const err = parseGameEvent(
      { kind: 'down', seq: 1, t: 0, code },
      EVENT_LOG_VERSION_TELEMETRY
    )._unsafeUnwrapErr()
    expect(err.code).toBe('bad-shape')
  })

  it('unknown kinds are still rejected under v2', () => {
    const err = parseGameEvent(
      { kind: 'hold', seq: 1, t: 0, code: 'KeyF' },
      EVENT_LOG_VERSION_TELEMETRY
    )._unsafeUnwrapErr()
    expect(err.code).toBe('bad-kind')
  })

  it('parseEventBatch routes the grammar by the batch version', () => {
    const events = [down]
    expect(parseEventBatch({ version: 1, events })._unsafeUnwrapErr().code).toBe('bad-kind')
    const batch = parseEventBatch({ version: 2, events })._unsafeUnwrap()
    expect(batch.version).toBe(2)
    expect(batch.events).toEqual([keyDownEvent(1, 0, 'KeyF')])
  })

  it('rejects versions that are neither 1 nor 2', () => {
    expect(parseEventBatch({ version: 3, events: [] })._unsafeUnwrapErr().code).toBe('bad-version')
    expect(parseEventBatch({ version: '2', events: [] })._unsafeUnwrapErr().code).toBe(
      'bad-version'
    )
  })
})

// ── validateLog: v2 structural rules ─────────────────────────────────────────

describe('validateLog and telemetry', () => {
  const snap: ConfigSnapshot = { config: coreCfg(), generation: gen() }

  it('a v1 log containing telemetry is invalid', () => {
    const words = wordsFor(7, gen())
    const { v2 } = typeAllTwins(words)
    const mislabeled: EventLog = { version: EVENT_LOG_VERSION, events: v2.events }
    const report = validate(7, mislabeled, snap)._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/telemetry/)
  })

  it('telemetry consumes seq: a gap through a dropped down is structural', () => {
    const words = wordsFor(7, gen())
    const { v2 } = typeAllTwins(words)
    const events = v2.events.filter((e) => e.seq !== 4)
    const report = validate(7, { version: EVENT_LOG_VERSION_TELEMETRY, events }, snap)
    expect(report._unsafeUnwrap().verdict).toBe('invalid')
    expect(report._unsafeUnwrap().reason).toMatch(/seq gap/)
  })

  it('an up without a preceding down is a scored flag, never invalid', () => {
    const words = wordsFor(7, gen())
    const { v2 } = typeAllTwins(words)
    // A key held before the log started: its release arrives unpaired. Renumber
    // to keep the log contiguous, exactly as a real capture would have.
    const events: GameEvent[] = [keyUpEvent(1, 50, 'ShiftLeft'), ...v2.events].map((e, i) => ({
      ...e,
      seq: asSeq(i + 1)
    }))
    const report = validate(
      7,
      { version: EVENT_LOG_VERSION_TELEMETRY, events },
      snap
    )._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    const flag = report.flags.find((f) => f.code === 'unpaired-keyup')
    expect(flag).toBeDefined()
    expect(flag!.score).toBeGreaterThan(0)
  })

  it('paired holds and overlaps raise no flag', () => {
    const words = wordsFor(7, gen())
    const { v2 } = typeAllTwins(words)
    const report = validate(7, v2, snap)._unsafeUnwrap()
    expect(report.flags.map((f) => f.code)).not.toContain('unpaired-keyup')
  })

  it('a trailing key release past the timed deadline stays valid', () => {
    const timedGen = gen({ mode: 'time' })
    const words = wordsFor(9, timedGen)
    const timedSnap: ConfigSnapshot = {
      config: coreCfg({ mode: 'time', durationMs: 5000 }),
      generation: timedGen
    }
    const events: GameEvent[] = [
      keyDownEvent(1, 0, 'KeyA'),
      insertEvent(2, 8, words[0][0]),
      keyUpEvent(3, 40, 'KeyA'),
      keyDownEvent(4, 4900, 'KeyB'),
      insertEvent(5, 4908, words[0][1]),
      // The run's deadline (anchored at the first STATE event, t=8) passes at
      // t=5008; the final release lands after it and must not invalidate.
      keyUpEvent(6, 5100, 'KeyB')
    ]
    const report = validate(
      9,
      { version: EVENT_LOG_VERSION_TELEMETRY, events },
      timedSnap
    )._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
  })

  it('a STATE event past the timed deadline is still a teleport', () => {
    const timedGen = gen({ mode: 'time' })
    const words = wordsFor(9, timedGen)
    const timedSnap: ConfigSnapshot = {
      config: coreCfg({ mode: 'time', durationMs: 5000 }),
      generation: timedGen
    }
    const events: GameEvent[] = [insertEvent(1, 0, words[0][0]), insertEvent(2, 6000, words[0][1])]
    const report = validate(
      9,
      { version: EVENT_LOG_VERSION_TELEMETRY, events },
      timedSnap
    )._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/deadline/)
  })
})
