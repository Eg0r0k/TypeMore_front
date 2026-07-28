import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  type ModsDeclaration,
  type QuoteTextSource,
  EVENT_LOG_VERSION,
  activeModsV1,
  commitEvent,
  dictVersion,
  emitsRawTokens,
  fnv1a,
  foldLog,
  generateWords,
  insertEvent,
  makeSeedContext,
  modMultiplierV1,
  validateLog
} from '@shared/core'

/**
 * Fixed-text ("quote") runs — the second text source beside the seeded one.
 *
 * The load-bearing property of the whole feature is that ADDING it changed
 * nothing: `textSource` is optional, absence means seeded, and the seeded
 * branch is byte-for-byte the code it always was. Half of this file defends
 * that; the other half defends the quote branch itself.
 */

const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
}

/** A dictionary that shares no word with `dict` — proves the quote path ignores it. */
const otherDict: Dictionary = { name: 'other', bcp47: 'fr', words: ['un', 'deux', 'trois'] }

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 8,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const QUOTE_TEXT = 'the quick brown fox jumps over the lazy dog'

const quoteSource = (text = QUOTE_TEXT): QuoteTextSource => ({
  kind: 'quote',
  quoteId: '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e',
  quoteHash: dictVersion([text]),
  text
})

const quoteGen = (over: Partial<GenerationConfig> = {}): GenerationConfig =>
  gen({ mode: 'quote', length: 0, textSource: quoteSource(), ...over })

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const noMods: ModsDeclaration = { blind: false, fading: false, flashlight: false }

/** Type every word correctly, with human-ish jitter so no cadence flag fires. */
function typeAll(words: readonly string[]): EventLog {
  const events: GameEvent[] = []
  let seq = 1
  let t = 0
  for (const word of words) {
    for (const ch of word) {
      events.push(insertEvent(seq++, t, ch))
      t += 80 + (seq % 6) * 12
    }
    events.push(commitEvent(seq++, t))
  }
  return { version: EVENT_LOG_VERSION, events }
}

// ── The seeded path is untouched ──────────────────────────────────────────────

describe('seeded generation is byte-identical to the pre-quote core', () => {
  /**
   * A hard-coded vector, verified against the implementation as it stood before
   * `textSource` existed. If a refactor of `generateWords` — the quadratic
   * `reduce` fix included — ever perturbs the seeded PRNG stream by one draw,
   * this is the line that says so, and every stored run and golden log in the
   * system would have been silently invalidated with it.
   */
  it('reproduces the golden word list for a fixed (dict, seed, config)', () => {
    const words = generateWords(
      dict,
      makeSeedContext(dict, 20250726, gen({ punctuation: true, numbers: true }))
    )._unsafeUnwrap().words
    expect(words).toEqual(['Bravo', 'charlie', 'echo', '469', '5', 'echo', '061', 'alpha'])
  })

  it('an ABSENT textSource and an explicit {kind:"seeded"} are the same run', () => {
    const absent = generateWords(dict, makeSeedContext(dict, 7, gen()))._unsafeUnwrap()
    const explicit = generateWords(
      dict,
      makeSeedContext(dict, 7, gen({ textSource: { kind: 'seeded' } }))
    )._unsafeUnwrap()
    expect(explicit.words).toEqual(absent.words)
    expect(explicit.context.dictVersion).toBe(absent.context.dictVersion)
    expect(absent.context.dictVersion).toBe(dictVersion(dict.words))
  })

  it('EVENT_LOG_VERSION is still 1 — no wire break was needed', () => {
    expect(EVENT_LOG_VERSION).toBe(1)
  })

  it('a snapshot with no textSource validates exactly as one that says "seeded"', () => {
    const words = generateWords(dict, makeSeedContext(dict, 3, gen()))._unsafeUnwrap().words
    const log = typeAll(words)
    const validateWith = (generation: GenerationConfig) =>
      validateLog({
        seed: 3,
        dictionary: dict,
        dictVersion: dictVersion(dict.words),
        configSnapshot: { config: coreCfg(), generation },
        log
      })._unsafeUnwrap()

    expect(validateWith(gen({ textSource: { kind: 'seeded' } }))).toEqual(validateWith(gen()))
    expect(validateWith(gen()).verdict).toBe('valid')
  })
})

// ── Quote targets ─────────────────────────────────────────────────────────────

describe('quote targets are the text, split on spaces', () => {
  it('splits on spaces and nothing else', () => {
    const words = generateWords(dict, makeSeedContext(dict, 1, quoteGen()))._unsafeUnwrap().words
    expect(words).toEqual(QUOTE_TEXT.split(' '))
  })

  it('drops empty targets from runs of spaces and leading/trailing space', () => {
    const text = '  double  spaced  text  '
    const words = generateWords(
      dict,
      makeSeedContext(dict, 1, quoteGen({ textSource: quoteSource(text) }))
    )._unsafeUnwrap().words
    // An empty target is not a typeable word: the player could never satisfy it.
    expect(words).toEqual(['double', 'spaced', 'text'])
  })

  it('ends a token at every newline, so a tab opens the next one', () => {
    // Ported from monkeytype (`words-generator.ts`): a line break is rewritten
    // to "\n " before the split, so it closes its token and the indentation
    // that follows opens the next. A mid-token newline is both unrenderable
    // (a target is one box and its tail cannot move to the next visual line)
    // and untypeable (Enter would either discard the tail or not break at all).
    const words = generateWords(
      dict,
      makeSeedContext(dict, 1, quoteGen({ textSource: quoteSource('a\nb c\td') }))
    )._unsafeUnwrap().words
    expect(words).toEqual(['a\n', 'b', 'c\td'])
  })

  it('turns a doubled newline into a token of its own — a blank line', () => {
    const words = generateWords(
      dict,
      makeSeedContext(dict, 1, quoteGen({ textSource: quoteSource('a\n\nb') }))
    )._unsafeUnwrap().words
    expect(words).toEqual(['a\n', '\n', 'b'])
  })

  it('absorbs the spaces around a newline rather than emitting empty targets', () => {
    const words = generateWords(
      dict,
      makeSeedContext(dict, 1, quoteGen({ textSource: quoteSource('a  \n  b') }))
    )._unsafeUnwrap().words
    expect(words).toEqual(['a\n', 'b'])
  })

  it('rejects a text with no typeable word instead of building an empty run', () => {
    const error = generateWords(
      dict,
      makeSeedContext(dict, 1, quoteGen({ textSource: quoteSource('   ') }))
    )._unsafeUnwrapErr()
    expect(error.kind).toBe('EmptyQuote')
  })

  /**
   * The no-PRNG guarantee, asserted BY CONSTRUCTION rather than by spying: if a
   * single `mulberry32` draw reached the output, two different seeds could not
   * agree. Same for the dictionary — an empty one would fail `EmptyDictionary`
   * on the seeded path and is simply never consulted here.
   */
  it('consumes no PRNG: different seeds, different dictionaries, same targets', () => {
    const source = quoteSource()
    const targets = (d: Dictionary, seed: number) =>
      generateWords(d, {
        seed,
        dictVersion: source.quoteHash,
        generation: quoteGen()
      })._unsafeUnwrap().words

    const baseline = targets(dict, 1)
    expect(targets(dict, 999_999)).toEqual(baseline)
    expect(targets(otherDict, 42)).toEqual(baseline)
    expect(targets({ name: 'empty', bcp47: 'en', words: [] }, 7)).toEqual(baseline)
  })

  /**
   * Replay: a finished quote run is nothing but `{quoteId, quoteHash, text}`
   * plus the log. Rebuilding the seed context from those three alone — no
   * dictionary, no seed the original used — must land on the same targets, or
   * every keystroke in the log lines up against the wrong word.
   */
  it('replays from {quoteId, quoteHash, text} alone', () => {
    const original = generateWords(dict, makeSeedContext(dict, 12345, quoteGen()))._unsafeUnwrap()

    // Everything a stored run keeps about its text source.
    const stored = original.context.generation.textSource
    expect(stored).toEqual({
      kind: 'quote',
      quoteId: '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e',
      quoteHash: original.context.dictVersion,
      text: QUOTE_TEXT
    })

    const replayed = generateWords(otherDict, {
      seed: 0,
      dictVersion: original.context.dictVersion,
      generation: gen({ mode: 'quote', length: 0, textSource: stored })
    })._unsafeUnwrap()
    expect(replayed.words).toEqual(original.words)
  })
})

// ── dictVersion means the TEXT for a quote run ────────────────────────────────

describe('the seed context hashes the text, not the dictionary', () => {
  it('makeSeedContext records dictVersion([text]) — the server`s textHash', () => {
    const context = makeSeedContext(dict, 5, quoteGen())
    expect(context.dictVersion).toBe(dictVersion([QUOTE_TEXT]))
    expect(context.dictVersion).not.toBe(dictVersion(dict.words))
    // QUOTES.md: `text_hash = core.DictVersion([]string{quote.Text})`. The
    // one-element join is a no-op, so the digest is exactly fnv1a of the text —
    // the same artefact convention `dictHash` uses.
    expect(context.dictVersion).toBe(fnv1a(QUOTE_TEXT).toString(16).padStart(8, '0'))
  })

  it('the dictionary may be absent entirely — a quote-only language has none', () => {
    const empty: Dictionary = { name: 'code_python', bcp47: 'en', words: [] }
    const generated = generateWords(empty, makeSeedContext(empty, 5, quoteGen()))
    expect(generated.isOk()).toBe(true)
    expect(generated._unsafeUnwrap().words).toEqual(QUOTE_TEXT.split(' '))
  })

  it('still guards drift — a hash that does not match the text is refused', () => {
    const generated = generateWords(dict, {
      seed: 5,
      dictVersion: 'deadbeef',
      generation: quoteGen()
    })
    expect(generated._unsafeUnwrapErr().kind).toBe('DictVersionMismatch')
  })
})

// ── Word-affecting mods are inapplicable, via the rawTokens gate ──────────────

describe('word-affecting mods are gated for verbatim targets', () => {
  const WORD_MODS = { punctuation: true, numbers: true, randomCase: true, reverse: true }

  it('emitsRawTokens is the single predicate both quotes and code tokens take', () => {
    expect(emitsRawTokens(gen())).toBe(false)
    expect(emitsRawTokens(gen({ rawTokens: true }))).toBe(true)
    expect(emitsRawTokens(quoteGen())).toBe(true)
  })

  it('a quote scores the same multiplier with the word mods on as with them off', () => {
    const config = coreCfg({ mode: 'quote' })
    const off = modMultiplierV1({ generation: quoteGen(), config }, noMods)
    const on = modMultiplierV1({ generation: quoteGen(WORD_MODS), config }, noMods)
    expect(on).toBe(off)
    expect(on).toBe(1)
    // The seeded run with the same flags DOES pay for them — otherwise this
    // test would pass with the multiplier table deleted.
    expect(modMultiplierV1({ generation: gen(WORD_MODS), config }, noMods)).toBeGreaterThan(1)
  })

  it('the gate is the rawTokens path, so code dictionaries behave the same', () => {
    const config = coreCfg()
    const raw = modMultiplierV1(
      { generation: gen({ ...WORD_MODS, rawTokens: true }), config },
      noMods
    )
    expect(raw).toBe(1)
  })

  it('names no word-affecting mod in the breakdown, but keeps the rest', () => {
    const config = coreCfg({ mode: 'quote', nospace: true, difficulty: 'expert', minWpm: 60 })
    const ids = activeModsV1({ generation: quoteGen(WORD_MODS), config }, noMods).map((m) => m.id)
    expect(ids).not.toContain('punctuation')
    expect(ids).not.toContain('numbers')
    expect(ids).not.toContain('randomCase')
    expect(ids).not.toContain('reverse')
    // nospace, difficulty and minWpm are input rules, not text transforms.
    expect(ids).toEqual(['nospace', 'expert', 'minSpeed60'])
  })

  it('still credits the declared view-only mods, which a quote does not affect', () => {
    const config = coreCfg({ mode: 'quote' })
    const withBlind = modMultiplierV1(
      { generation: quoteGen(WORD_MODS), config },
      {
        blind: true,
        fading: false,
        flashlight: false
      }
    )
    expect(withBlind).toBeGreaterThan(1)
  })
})

// ── Same reducer, same verdict ────────────────────────────────────────────────

describe('a quote run folds and validates exactly like a seeded one', () => {
  // The quote text IS the seeded run's word list, so the two runs have
  // identical targets and can share one event log. Anything the reducer or the
  // validator does differently for a quote shows up as a difference here.
  const seededWords = generateWords(dict, makeSeedContext(dict, 4242, gen()))._unsafeUnwrap().words
  const text = seededWords.join(' ')
  const log = typeAll(seededWords)

  const quoteGeneration = gen({
    mode: 'quote',
    length: 0,
    textSource: { ...quoteSource(text) }
  })

  it('produces the same targets from either source', () => {
    const fromQuote = generateWords(dict, makeSeedContext(dict, 1, quoteGeneration))._unsafeUnwrap()
      .words
    expect(fromQuote).toEqual(seededWords)
  })

  it('foldLog finishes on the LAST COMMITTED WORD, with no length target', () => {
    const words = generateWords(dict, makeSeedContext(dict, 1, quoteGeneration))._unsafeUnwrap()
      .words
    const ctx = { config: coreCfg({ mode: 'quote' }), words }
    const state = foldLog(ctx, log.events)._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.wordIndex).toBe(words.length)
    // The run's length is the text's: `generation.length` is 0 and unused.
    expect(quoteGeneration.length).toBe(0)
  })

  it('validateLog returns the same verdict, flags and metrics for both sources', () => {
    const seededReport = validateLog({
      seed: 4242,
      dictionary: dict,
      dictVersion: dictVersion(dict.words),
      configSnapshot: { config: coreCfg(), generation: gen() } satisfies ConfigSnapshot,
      log
    })._unsafeUnwrap()

    const quoteReport = validateLog({
      seed: 0,
      dictionary: otherDict,
      dictVersion: dictVersion([text]),
      configSnapshot: {
        config: coreCfg({ mode: 'quote' }),
        generation: quoteGeneration
      } satisfies ConfigSnapshot,
      log
    })._unsafeUnwrap()

    expect(quoteReport.verdict).toBe('valid')
    expect(quoteReport).toEqual(seededReport)
  })

  it('invalidates a quote log whose version is not one the server accepts', () => {
    // 2 became legal with the telemetry log; 3 is the unsupported specimen now.
    const report = validateLog({
      seed: 0,
      dictionary: otherDict,
      dictVersion: dictVersion([text]),
      configSnapshot: { config: coreCfg({ mode: 'quote' }), generation: quoteGeneration },
      log: { version: 3, events: log.events } as unknown as EventLog
    })._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/log version 3 != 1/)
  })
})
