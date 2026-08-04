import { describe, it, expect } from 'vitest'

import {
  EVENT_LOG_VERSION,
  insertEvent,
  type CoreConfig,
  type GenerationConfig,
  type Metrics,
  type ModsDeclaration,
  type ScoreResult
} from '@typemore/core'
import {
  buildRunPayload,
  isSubmittableRun,
  SCORE_VERSION,
  type RunSubmitContext
} from '@/features/run-submit/model/build-payload'

// A representative finished-run context. Mirrors the RUNS.md example body so the
// snapshot below is a direct contract check against the documented payload.
const config: CoreConfig = {
  mode: 'time',
  durationMs: 15000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const generation: GenerationConfig = {
  mode: 'time',
  length: 15,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}

const declaration: ModsDeclaration = { blind: false, fading: false, flashlight: false }

const metrics: Metrics = {
  wpm: 80,
  raw: 85,
  accuracy: 0.97,
  consistency: 72,
  chars: { correct: 200, incorrect: 6, extra: 0, missed: 0 },
  spaces: 40,
  durationSec: 15
}

const score: ScoreResult = {
  version: 2,
  total: 1234,
  base: 1300,
  comboPeak: 50,
  accMultiplier: 0.94,
  timeBonus: null,
  modMultiplier: 1
}

const log = [insertEvent(1, 12, 't')]

const timeCtx = (): RunSubmitContext => ({
  mode: 'time',
  config,
  generation,
  declaration,
  lang: 'en',
  seed: 2864901,
  dictHash: 'a1b2c3d4',
  metrics,
  score,
  log
})

const QUOTE_TEXT = 'the quick brown fox'
const QUOTE_ID = '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e'

const quoteCtx = (): RunSubmitContext => ({
  ...timeCtx(),
  mode: 'quote',
  config: { ...config, mode: 'quote' },
  generation: {
    ...generation,
    mode: 'quote',
    // A quote has no magnitude — its length is the text's.
    length: 0,
    textSource: {
      kind: 'quote',
      quoteId: QUOTE_ID,
      quoteHash: '8b1cf30a',
      text: QUOTE_TEXT
    }
  },
  dictHash: '8b1cf30a'
})

describe('isSubmittableRun — a run the server can rank names its own dimension', () => {
  const withMode = (mode: RunSubmitContext['mode']): RunSubmitContext => ({
    ...timeCtx(),
    mode,
    config: { ...config, mode },
    generation: { ...generation, mode }
  })

  it('accepts the two seeded shapes', () => {
    expect(isSubmittableRun(withMode('time'))).toBe(true)
    expect(isSubmittableRun(withMode('words'))).toBe(true)
  })

  /**
   * The change this phase made. `quote` used to sit beside free/custom as
   * "never submitted"; it is nothing like them. The server re-resolves the text
   * by id and judges it on the same track as a seeded run, onto that quote's
   * own board.
   */
  it('accepts a quote run — it names its text instead of a size', () => {
    expect(isSubmittableRun(quoteCtx())).toBe(true)
  })

  it('rejects the shapes that name no dimension at all', () => {
    expect(isSubmittableRun(withMode('free'))).toBe(false)
    expect(isSubmittableRun(withMode('custom'))).toBe(false)
  })

  /**
   * The predicate reads the resolved TEXT SOURCE, not the mode label — which is
   * what makes it a property rather than a second list of mode names.
   *
   * `mode: 'quote'` with NO textSource is a config that names a fixed text and
   * supplies none. It is refused rather than guessed at: the payload it would
   * produce carries `mode: "quote"` and no textSource, so the server reads it as
   * seeded, demands exactly one dimension, and answers 422 invalid_dimensions.
   * Failing here is the same verdict without the round trip.
   */
  it('refuses a quote-labelled run whose text source never resolved', () => {
    const labelledOnly = withMode('quote')
    expect(labelledOnly.generation.textSource).toBeUndefined()
    expect(isSubmittableRun(labelledOnly)).toBe(false)
  })
})

describe('buildRunPayload — RUNS.md field-for-field (contract-drift guard)', () => {
  it('maps every documented field for a time-mode run', () => {
    const payload = buildRunPayload(timeCtx())

    // Exact top-level key set — a new/removed field trips this guard.
    expect(Object.keys(payload).sort()).toEqual(
      [
        'clientMetrics',
        'clientScore',
        'dictHash',
        'durationMs',
        'lang',
        'log',
        'mode',
        'scoreVersion',
        'seed',
        'setup'
      ].sort()
    )

    expect(payload.mode).toBe('time')
    expect(payload.durationMs).toBe(15000)
    // Exactly one dimension: time carries durationMs, never wordCount.
    expect('wordCount' in payload).toBe(false)
    expect(payload.lang).toBe('en')
    expect(payload.seed).toBe(2864901)
    expect(payload.dictHash).toBe('a1b2c3d4')
    expect(payload.scoreVersion).toBe(SCORE_VERSION)
    expect(payload.scoreVersion).toBe(3)

    // toEqual verifies the exact setup shape ({config, generation, declaration}) — no extra keys.
    expect(payload.setup).toEqual({ config, generation, declaration })

    expect(payload.clientMetrics).toEqual({ wpm: 80, raw: 85, acc: 0.97 })
    expect(payload.clientScore).toEqual(score)

    // RUNS.md: log.version must equal 1. The payload wraps events in the core EventLog.
    expect(EVENT_LOG_VERSION).toBe(1)
    expect(payload.log).toEqual({ version: 1, events: log })
  })

  it('carries wordCount (never durationMs) for a words-mode run', () => {
    const payload = buildRunPayload({
      ...timeCtx(),
      mode: 'words',
      config: { ...config, mode: 'words' },
      generation: { ...generation, mode: 'words', length: 25 }
    })

    expect(payload.mode).toBe('words')
    expect(payload.wordCount).toBe(25)
    expect('durationMs' in payload).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(
      [
        'clientMetrics',
        'clientScore',
        'dictHash',
        'lang',
        'log',
        'mode',
        'scoreVersion',
        'seed',
        'setup',
        'wordCount'
      ].sort()
    )
  })

  /**
   * The seeded payload is the regression that matters most: adding a second
   * text source must not move one byte of the shape the server already
   * accepts. `toEqual` on the whole body, not a field walk.
   */
  it('emits a byte-identical body for a seeded run (no textSource anywhere)', () => {
    expect(buildRunPayload(timeCtx())).toEqual({
      mode: 'time',
      durationMs: 15000,
      lang: 'en',
      seed: 2864901,
      dictHash: 'a1b2c3d4',
      scoreVersion: 3,
      setup: { config, generation, declaration },
      clientMetrics: { wpm: 80, raw: 85, acc: 0.97 },
      clientScore: score,
      log: { version: 1, events: log }
    })
    expect(JSON.stringify(buildRunPayload(timeCtx()))).not.toContain('textSource')
  })
})

describe('buildRunPayload — a quote run names its text, never carries it', () => {
  it('emits quoteId + quoteHash, strips the text, and carries no dimension', () => {
    const payload = buildRunPayload(quoteCtx())

    // Exact top-level key set: NEITHER durationMs NOR wordCount. The server
    // relaxes its one-of-two check for quotes in Stage C.
    expect(Object.keys(payload).sort()).toEqual(
      [
        'clientMetrics',
        'clientScore',
        'dictHash',
        'lang',
        'log',
        'mode',
        'scoreVersion',
        'seed',
        'setup'
      ].sort()
    )
    expect('durationMs' in payload).toBe(false)
    expect('wordCount' in payload).toBe(false)

    // The exact setup shape, text excluded. `toEqual` so an extra key — a
    // smuggled `text` above all — trips the guard.
    expect(payload.setup).toEqual({
      config: { ...config, mode: 'quote' },
      generation: {
        mode: 'quote',
        length: 0,
        punctuation: false,
        numbers: false,
        randomCase: false,
        reverse: false,
        textSource: {
          kind: 'quote',
          quoteId: QUOTE_ID,
          quoteHash: '8b1cf30a'
        }
      },
      declaration
    })

    // Belt and braces: the text must not survive serialization anywhere in the
    // body — not in `setup`, not smuggled through another field.
    expect(JSON.stringify(payload)).not.toContain(QUOTE_TEXT)

    // dictHash is the quote's content hash — the seed context recorded it.
    expect(payload.dictHash).toBe('8b1cf30a')
    expect(payload.mode).toBe('quote')
  })

  it('does not mutate the caller`s generation config', () => {
    const ctx = quoteCtx()
    buildRunPayload(ctx)
    expect(ctx.generation.textSource).toEqual({
      kind: 'quote',
      quoteId: QUOTE_ID,
      quoteHash: '8b1cf30a',
      text: QUOTE_TEXT
    })
  })
})

describe('buildRunPayload — text provenance (RUNS.md "Text provenance")', () => {
  const RACED_RUN_ID = '8f14e45f-ceea-4d0e-9c9a-1b0c9d8e3f2a'

  /**
   * The rule is about where the TEXT came from and about nothing else.
   *
   * A pace caret or a ghost is drawn by the page; it never reaches this
   * function, and there is no field it could reach. So a run played with one
   * over a freshly generated text produces the very same bytes as a run played
   * with an empty field — which is the strongest form the claim can take: not
   * "the caret is ignored" but "the caret is not expressible".
   */
  it('is byte-identical with or without an opponent on screen', () => {
    const alone = buildRunPayload(timeCtx())
    const raced = buildRunPayload(timeCtx())
    expect(JSON.stringify(raced)).toBe(JSON.stringify(alone))
    expect(JSON.stringify(alone)).not.toContain('adoptedFromRunId')
  })

  it('omits the marker entirely when the text was generated fresh', () => {
    const payload = buildRunPayload(timeCtx())
    expect('adoptedFromRunId' in payload.setup).toBe(false)
    // The legacy shape, unchanged: exactly the three snapshot halves.
    expect(Object.keys(payload.setup).sort()).toEqual(
      ['config', 'declaration', 'generation'].sort()
    )
  })

  it('names the origin run when the text was adopted from one', () => {
    const payload = buildRunPayload({ ...timeCtx(), adoptedFromRunId: RACED_RUN_ID })

    expect(payload.setup).toEqual({
      adoptedFromRunId: RACED_RUN_ID,
      config,
      generation,
      declaration
    })
    // Top level of `setup`, NOT inside `generation`: the core reconstructs a run
    // from `generation`, so a provenance note living there could influence a
    // target. It must be invisible to the fold.
    expect(JSON.stringify(payload.setup.generation)).not.toContain('adoptedFromRunId')
  })

  it('carries the marker on a quote run too — the rule is not about the mode', () => {
    const payload = buildRunPayload({ ...quoteCtx(), adoptedFromRunId: RACED_RUN_ID })
    expect((payload.setup as { adoptedFromRunId?: string }).adoptedFromRunId).toBe(RACED_RUN_ID)
    // …and still names its quote, still carries no dimension.
    expect('durationMs' in payload).toBe(false)
    expect('wordCount' in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toContain(QUOTE_TEXT)
  })

  /**
   * The marker must not disturb anything else. Stripping it from an adopted
   * payload has to leave the exact bytes a fresh run of the same setup produces
   * — otherwise "the same run, told apart by one field" would not be true, and
   * the server's twin tests would be comparing two different runs.
   */
  it('changes nothing but its own key', () => {
    const adopted = buildRunPayload({ ...timeCtx(), adoptedFromRunId: RACED_RUN_ID })
    const { adoptedFromRunId: _origin, ...setup } = adopted.setup as Record<string, unknown>
    expect(JSON.stringify({ ...adopted, setup })).toBe(JSON.stringify(buildRunPayload(timeCtx())))
  })
})
