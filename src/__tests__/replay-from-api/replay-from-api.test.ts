/**
 * `replayFromApi` is the READ-direction contract boundary: whatever the server
 * says, either a playable `ReplayData` comes out or a NAMED failure does. These
 * tests defend the four things that would otherwise fail silently — words that
 * are regenerated rather than believed, a score/grade that is the server's and
 * not a recomputation, a dictionary that provably hashes to what the run was
 * played on, and a `setup` that is narrowed instead of cast.
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAX_EXTRA_CHARS,
  dictVersion,
  generateWords,
  makeSeedContext,
  insertEvent,
  type CoreConfig,
  type Dictionary,
  type GameEvent,
  type GenerationConfig,
  type ModsDeclaration,
  type ScoreResult
} from '@typemore/core'
import type { DictionaryBody, Quote, RunReplay, RunReplayLog } from '@shared/api'
import { quoteRefOf, replayFromApi, type ReplayTextSource } from '@/features/replay-view'

// ── Fixtures ─────────────────────────────────────────────────────────────────
// The hash is COMPUTED from the fixture word list, never written by hand: a
// hard-coded digest the fixture does not actually hash to would make the happy
// path exercise the mismatch branch and pass for the wrong reason.
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']
const DICT_HASH = dictVersion(WORDS)
const SEED = 20260724

const dictBody = (over: Partial<DictionaryBody> = {}): DictionaryBody => ({
  name: 'english',
  words: WORDS,
  bcp47: 'en-US',
  rightToleft: false,
  ...over
})

/**
 * The adapter takes a discriminated TEXT SOURCE, not a dictionary body: a quote
 * run's text lives in the quote registry and is addressed by id, so "the bytes
 * this run was played on" has two shapes.
 */
const dictSource = (over: Partial<DictionaryBody> = {}): ReplayTextSource => ({
  kind: 'dictionary',
  body: dictBody(over)
})

const config: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const generation: GenerationConfig = {
  mode: 'words',
  length: 5,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}

const declaration: ModsDeclaration = { blind: false, fading: false, flashlight: false }

const serverScore: ScoreResult = {
  version: 2,
  total: 2864,
  base: 1900,
  comboPeak: 25,
  accMultiplier: 1,
  timeBonus: 1.12,
  modMultiplier: 1.35
}

const metaOf = (over: Partial<RunReplay> = {}): RunReplay => ({
  runId: 'e865dae0-0000-4000-8000-000000000001',
  displayName: 'boardsmoke',
  mode: 'words',
  wordCount: 5,
  lang: 'en-US',
  seed: SEED,
  dictHash: DICT_HASH,
  setup: { config, generation, declaration },
  serverMetrics: { wpm: 83.24, raw: 83.24, accuracy: 1 },
  serverScore,
  grade: 'SS',
  achievedAt: '2026-07-25T13:43:14.772724Z',
  ...over
})

const events: GameEvent[] = [insertEvent(1, 12, 'a'), insertEvent(2, 90, 'l')]
const logOf = (): RunReplayLog => ({ version: 1, events })

/** What the core itself produces for this seed — the oracle for `words`. */
const expectedWords = (): readonly string[] => {
  const dictionary: Dictionary = { name: 'english', bcp47: 'en-US', words: WORDS }
  const generated = generateWords(dictionary, makeSeedContext(dictionary, SEED, generation))
  if (generated.isErr()) throw new Error('fixture generation failed')
  return generated.value.words
}

describe('replayFromApi — happy path', () => {
  it('regenerates the run text from the seed rather than trusting anything on the wire', () => {
    const result = replayFromApi(metaOf(), logOf(), dictSource())

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.words).toEqual(expectedWords())
    // A run is 5 words long here; a silently empty or default-length list is the
    // failure mode a shallow `toBeDefined` would miss.
    expect(result.value.words).toHaveLength(5)
  })

  it('a different seed yields a different text — the seed is actually used', () => {
    const same = replayFromApi(metaOf(), logOf(), dictSource())
    const other = replayFromApi(metaOf({ seed: SEED + 1 }), logOf(), dictSource())

    expect(same.isOk() && other.isOk()).toBe(true)
    if (same.isErr() || other.isErr()) return
    expect(other.value.words).not.toEqual(same.value.words)
  })

  it('carries the SERVER’s score and grade, not a recomputation', () => {
    const result = replayFromApi(
      metaOf({ serverScore: { ...serverScore, total: 1 }, grade: 'C' }),
      logOf(),
      dictSource()
    )

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    // Numbers a local recomputation would never produce for this log: the point
    // is that a spectator watches the run the server judged.
    expect(result.value.score.total).toBe(1)
    expect(result.value.score.modMultiplier).toBe(1.35)
    expect(result.value.grade).toBe('C')
  })

  it('maps the rest of ReplayData from the setup snapshot and the log body', () => {
    const result = replayFromApi(metaOf(), logOf(), dictSource())

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.config).toMatchObject(config)
    expect(result.value.generation).toMatchObject(generation)
    expect(result.value.declaration).toEqual(declaration)
    expect(result.value.log).toEqual(events)
  })

  it('keeps unknown snapshot fields instead of stripping them', () => {
    // `CoreConfig`/`GenerationConfig` grow by OPTIONAL fields with legacy
    // defaults, so a snapshot from a newer client must reconstruct verbatim.
    const result = replayFromApi(
      metaOf({
        setup: {
          config: { ...config, someFutureToggle: true },
          generation,
          declaration
        }
      }),
      logOf(),
      dictSource()
    )

    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value.config).toHaveProperty('someFutureToggle', true)
  })
})

describe('replayFromApi — the dictionary must be the one the run was played on', () => {
  it('reports DictHashMismatch, distinctly from any other failure', () => {
    const result = replayFromApi(metaOf(), logOf(), dictSource({ words: [...WORDS, 'golf'] }))

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('DictHashMismatch')
    expect(result.error.message).toContain(DICT_HASH)
  })

  it('checks the hash BEFORE the setup, so a drifted dictionary is never blamed on the run', () => {
    // Both are wrong. The hash check runs first because regenerating words
    // against the wrong list produces a plausible lie, which is worse than a
    // loud parse failure.
    const result = replayFromApi(
      metaOf({ setup: { nonsense: true } }),
      logOf(),
      dictSource({ words: ['nope'] })
    )

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('DictHashMismatch')
  })

  it('a same-length but different word list still mismatches', () => {
    const swapped = [...WORDS.slice(0, -1), 'golf']
    const result = replayFromApi(metaOf(), logOf(), dictSource({ words: swapped }))

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('DictHashMismatch')
  })
})

describe('replayFromApi — generation failure is its own variant', () => {
  it('propagates an empty dictionary as GenerationFailed, not as a mismatch', () => {
    // An empty list hashes consistently, so the hash gate passes and the core's
    // own `EmptyDictionary` guard is what fires.
    const empty: string[] = []
    const result = replayFromApi(
      metaOf({ dictHash: dictVersion(empty) }),
      logOf(),
      dictSource({ words: empty })
    )

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('GenerationFailed')
    expect(result.error.message).toContain('EmptyDictionary')
  })
})

describe('replayFromApi — malformed boundary fields fail loudly', () => {
  it('rejects a setup missing `generation` rather than half-building a ReplayData', () => {
    const result = replayFromApi(metaOf({ setup: { config, declaration } }), logOf(), dictSource())

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('MalformedSetup')
  })

  it('rejects a setup whose config has the wrong field types', () => {
    const result = replayFromApi(
      metaOf({ setup: { config: { ...config, minWpm: 'fast' }, generation, declaration } }),
      logOf(),
      dictSource()
    )

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('MalformedSetup')
  })

  it('rejects `setup: null` — the whole snapshot absent', () => {
    const result = replayFromApi(metaOf({ setup: null }), logOf(), dictSource())

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('MalformedSetup')
  })

  it('rejects a serverScore that is not a ScoreResult', () => {
    const result = replayFromApi(metaOf({ serverScore: { total: 10 } }), logOf(), dictSource())

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('MalformedScore')
  })

  it('rejects a grade outside the letter set', () => {
    const result = replayFromApi(metaOf({ grade: 'A+' }), logOf(), dictSource())

    expect(result.isErr()).toBe(true)
    if (result.isOk()) return
    expect(result.error.kind).toBe('MalformedGrade')
  })
})

/**
 * Quote runs. Their text is NOT a word list: it lives in the quote registry and
 * is addressed by id, while the run's `dictHash` is `dictVersion([text])`.
 * Sending them through the dictionary endpoint is what made every quote replay
 * fail with "could not load the word list this run was played on" — the hash was
 * a perfectly valid address for a document that does not exist.
 */
describe('a quote run replays from the quote, not from a dictionary', () => {
  const QUOTE_TEXT = 'p.center {\n\ttext-align: center;\n}'
  const QUOTE_HASH = dictVersion([QUOTE_TEXT])
  const QUOTE_ID = '34173500-3ac6-4edb-a21b-00f02c1acf6e'

  const quote = (over: Partial<Quote> = {}): Quote => ({
    id: QUOTE_ID,
    lang: 'code_css',
    upstreamId: 3,
    source: 'W3Schools CSS Class Selector',
    length: QUOTE_TEXT.length,
    lenGroup: 'short',
    textHash: QUOTE_HASH,
    text: QUOTE_TEXT,
    superseded: false,
    ...over
  })

  const quoteSource = (over: Partial<Quote> = {}): ReplayTextSource => ({
    kind: 'quote',
    quote: quote(over)
  })

  /** The setup as `build-payload` writes it: the quote by id and hash, no text. */
  const quoteMeta = (over: Partial<RunReplay> = {}): RunReplay =>
    metaOf({
      mode: 'quote',
      wordCount: undefined,
      lang: 'code_css',
      dictHash: QUOTE_HASH,
      setup: {
        config: { ...config, mode: 'quote' },
        generation: {
          ...generation,
          mode: 'quote',
          length: 0,
          textSource: { kind: 'quote', quoteId: QUOTE_ID, quoteHash: QUOTE_HASH }
        },
        declaration
      },
      ...over
    })

  it('names the quote a run was played on, and nothing for a seeded run', () => {
    expect(quoteRefOf(quoteMeta())).toEqual({ quoteId: QUOTE_ID, quoteHash: QUOTE_HASH })
    expect(quoteRefOf(metaOf())).toBeNull()
  })

  it('regenerates the targets from the resolved text', () => {
    const result = replayFromApi(quoteMeta(), logOf(), quoteSource())

    expect(result.isOk()).toBe(true)
    // The generator's newline rule: a line break ends its token, so the text is
    // its own visual lines. This is the run as played, not a re-split.
    expect(result._unsafeUnwrap().words).toEqual([
      'p.center',
      '{\n',
      '\ttext-align:',
      'center;\n',
      '}'
    ])
  })

  it('puts the text back into the generation the player renders', () => {
    // The payload strips it for the wire; a replay that kept it stripped would
    // hand the player a seed context that cannot produce the run.
    const played = replayFromApi(quoteMeta(), logOf(), quoteSource())._unsafeUnwrap().generation
    expect(played.textSource).toEqual({
      kind: 'quote',
      quoteId: QUOTE_ID,
      quoteHash: QUOTE_HASH,
      text: QUOTE_TEXT
    })
  })

  it('rejects a quote whose bytes no longer hash to the run’s dictHash', () => {
    // Same class of failure as a drifted word list, and for the same reason: the
    // targets would differ from the ones the player typed.
    const result = replayFromApi(quoteMeta(), logOf(), quoteSource({ text: 'something else' }))

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().kind).toBe('DictHashMismatch')
    expect(result._unsafeUnwrapErr().message).toContain(QUOTE_ID)
  })

  it('never consults the dictionary — an empty one still replays', () => {
    // The proof that the quote branch is text-driven: `generateWords` reads no
    // word list at all, so the stub the adapter passes cannot matter.
    expect(replayFromApi(quoteMeta(), logOf(), quoteSource()).isOk()).toBe(true)
  })

  it('checks the quote hash BEFORE the setup, like the dictionary path', () => {
    const result = replayFromApi(
      quoteMeta({ setup: { nonsense: true } }),
      logOf(),
      quoteSource({ text: 'drifted' })
    )
    expect(result._unsafeUnwrapErr().kind).toBe('DictHashMismatch')
  })
})
