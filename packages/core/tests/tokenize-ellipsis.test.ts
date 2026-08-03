import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  type QuoteTextSource,
  EVENT_LOG_VERSION,
  areGraphemesEquivalent,
  commitEvent,
  dictVersion,
  expandEllipsis,
  foldLog,
  generateWords,
  insertEvent,
  makeSeedContext,
  normalizeGrapheme,
  validateLog
} from '@typemore/core'

/**
 * U+2026 HORIZONTAL ELLIPSIS, and the guillemets beside it.
 *
 * Two characters the corpora contain and no keyboard produces. They are
 * answered in two DIFFERENT places, and which place is not a style choice:
 *
 *   `…` is one character standing for three keystrokes, so it cannot be an
 *   equivalence — the registry maps one grapheme to one grapheme, and three
 *   presses against one target position would mean changing the reducer's
 *   arithmetic. It is rewritten in the TOKENIZER instead, where the target is
 *   built (`expandEllipsis`, words.ts).
 *
 *   `«»` are one character standing for one keystroke, so they ARE an
 *   equivalence and belong in normalize.ts with the other double quotes.
 *
 * The load-bearing property of the first is that it runs AFTER the corpus is
 * hashed. A dict hash is a dictionary's serving address and a quote hash is a
 * quote's identity; either moving would strand every run ever played on it.
 * (`internal/replay/corpus_hashes_test.go` and
 * `internal/quote/corpus/hashes_test.go` in the server repo pin all 430
 * dictionaries and all 15 817 quotes; this file pins the mechanism those two
 * files can only observe the result of.)
 */

// Real tokens, lifted from the vendored dictionaries rather than invented: two
// from belarusian_*k, two from tatar_crimean_*k, one from thai_*k. A synthetic
// "a…b" would not have caught the Thai case, where the ellipsis sits inside a
// word rather than closing it.
const ELLIPSIS_TOKENS = ['калі…', 'нова…', 'da…', 'olsun…', 'หา…ไม่'] as const

const dict: Dictionary = { name: 'ellipsis', bcp47: 'be', words: [...ELLIPSIS_TOKENS] }

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 5,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const quoteSource = (text: string): QuoteTextSource => ({
  kind: 'quote',
  quoteId: '2a1c0b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  quoteHash: dictVersion([text]),
  text
})

const targetsOf = (text: string): readonly string[] => {
  const generation = gen({ mode: 'quote', length: 0, textSource: quoteSource(text) })
  const context = makeSeedContext(dict, 1, generation)
  const generated = generateWords(dict, context)
  if (generated.isErr()) throw new Error(generated.error.message)
  return generated.value.words
}

// ── The rewrite itself ────────────────────────────────────────────────────────

describe('expandEllipsis', () => {
  it('leaves a token with no ellipsis strictly identical', () => {
    for (const token of ['plain', '', '...', 'a.b', '“It’s”']) {
      expect(expandEllipsis(token)).toBe(token)
    }
  })

  it('rewrites every occurrence, wherever it sits in the token', () => {
    expect(expandEllipsis('калі…')).toBe('калі...')
    expect(expandEllipsis('…калі')).toBe('...калі')
    expect(expandEllipsis('หา…ไม่')).toBe('หา...ไม่')
    expect(expandEllipsis('…')).toBe('...')
    expect(expandEllipsis('a……b')).toBe('a......b')
  })
})

// ── The quote path ────────────────────────────────────────────────────────────

describe('quote tokenization rewrites the ellipsis and moves no separator', () => {
  // The same six cases the server pins through goja
  // (`internal/replay/quote_targets_test.go`), stated as literals on both
  // sides rather than compared to each other: that is what makes them a
  // cross-repo contract instead of the bundle agreeing with itself.
  const cases: ReadonlyArray<{ name: string; text: string; want: string[] }> = [
    { name: 'opening a word', text: '…и снова', want: ['...и', 'снова'] },
    { name: 'inside a word', text: 'หา…ไม่ ok', want: ['หา...ไม่', 'ok'] },
    { name: 'closing a word', text: 'калі… нова…', want: ['калі...', 'нова...'] },
    { name: 'alone, as a whole token', text: 'a … b', want: ['a', '...', 'b'] },
    { name: 'twice in a row', text: 'wait…… what', want: ['wait......', 'what'] },
    { name: 'against a line ending', text: '…\n… x', want: ['...\n', '...', 'x'] }
  ]

  for (const tc of cases) {
    it(`expands an ellipsis ${tc.name}`, () => {
      expect(targetsOf(tc.text)).toEqual(tc.want)
    })
  }

  // The point of the previous block stated as a property rather than by
  // example: the rewrite is per token, so it cannot merge, split or reorder
  // them. Compared against the SAME text with the ellipses already spelled out
  // by hand — a reference the tokenizer had no part in building.
  it('produces exactly the tokenization the hand-spelled text would', () => {
    const text = '…start mid…dle end… … a\n…b'
    expect(targetsOf(text)).toEqual(targetsOf(text.split('…').join('...')))
  })

  it('leaves the quote hash on the author bytes, not on what is typed', () => {
    const text = 'калі… нова…'
    const source = quoteSource(text)
    // The hash the run records, the hash the server re-derives, and the hash
    // the drift guard checks are all this one — taken over the raw text.
    expect(source.quoteHash).toBe(dictVersion([text]))
    expect(source.quoteHash).not.toBe(dictVersion([text.split('…').join('...')]))

    const generation = gen({ mode: 'quote', length: 0, textSource: source })
    const context = makeSeedContext(dict, 7, generation)
    expect(context.dictVersion).toBe(source.quoteHash)
    // And generation still passes the drift check, which is the whole claim:
    // the targets changed, the identity did not.
    expect(generateWords(dict, context).isOk()).toBe(true)
  })
})

// ── The dictionary path ───────────────────────────────────────────────────────

describe('dictionary tokenization rewrites the ellipsis after hashing', () => {
  it('emits typeable targets while the dict hash stays on the raw word list', () => {
    const context = makeSeedContext(dict, 42, gen())
    expect(context.dictVersion).toBe(dictVersion(dict.words))

    const generated = generateWords(dict, context)
    expect(generated.isOk()).toBe(true)
    const words = generated._unsafeUnwrap().words
    expect(words).toHaveLength(5)
    for (const word of words) expect(word).not.toContain('…')
    // Every target is one of the five real tokens, spelled typeably.
    const expanded = ELLIPSIS_TOKENS.map(expandEllipsis)
    for (const word of words) expect(expanded).toContain(word)
  })

  // The vectors below were taken from the BUILT ESM of the core as it stood
  // before `expandEllipsis` existed (`dist/index.js` at the previous release).
  // They are the whole "before" half of this change: the new generator must
  // produce these lists with `…` spelled out and NOTHING else different.
  //
  // The trap they guard is the one `lazy` documents two functions up:
  // `randomCase` draws from the PRNG once PER CHARACTER, so a one-into-three
  // expansion running BEFORE `decorate` would consume different draws and shift
  // every word after it. `punctuation` and `numbers` are on for the same
  // reason — they are the other two PRNG consumers, and a shifted stream shows
  // up as a number where a word was.
  const BEFORE_DECORATED = [
    'НоВа…?',
    'КАЛІ…',
    'нОва…',
    'หา…ไม่',
    '4677',
    'нОВА…',
    'da…',
    'ноВа…',
    'OlSuN…',
    '8157',
    '4',
    'oLSUN…'
  ]

  it('consumes the PRNG exactly as it did before the rewrite existed', () => {
    const withMods = gen({ punctuation: true, randomCase: true, numbers: true, length: 12 })
    const words = generateWords(dict, makeSeedContext(dict, 99, withMods))._unsafeUnwrap().words

    expect(words).toEqual(BEFORE_DECORATED.map(expandEllipsis))
    // Said the other way, so the failure message names the drift rather than
    // the expansion: every target maps back onto the word the old core drew.
    expect(words.map((w) => w.split('...').join('…'))).toEqual(BEFORE_DECORATED)
  })

  it('does not let the expanded period start a new sentence', () => {
    // `...` ends in a character SENTENCE_END contains. Capitalization is read
    // off the DECORATED word, before the rewrite, so a word after an ellipsis
    // is capitalized only if it would have been anyway — otherwise this run's
    // word list would differ from the one its seed produced yesterday.
    const punctuated = gen({ punctuation: true, length: 12 })
    const words = generateWords(dict, makeSeedContext(dict, 3, punctuated))._unsafeUnwrap().words

    const startsUpper = (w: string) => w !== w.toLowerCase()
    const afterEllipsisOnly = words
      .map((w, i) => ({ w, prev: words[i - 1] ?? '' }))
      .filter(({ prev }) => prev.endsWith('...') && !/[.?!]$/.test(prev.slice(0, -3)))
    expect(afterEllipsisOnly.length).toBeGreaterThan(0)
    for (const { w } of afterEllipsisOnly) expect(startsUpper(w)).toBe(false)
  })

  it('rewrites verbatim (rawTokens) targets too', () => {
    // `rawTokens` means "no DECORATION". A code token nobody can type is as
    // broken as a word nobody can type, so typeability is not decoration.
    const raw = gen({ rawTokens: true })
    const words = generateWords(dict, makeSeedContext(dict, 5, raw))._unsafeUnwrap().words
    for (const word of words) expect(word).not.toContain('…')
  })

  it('commutes with the Reverse mod, because `...` is its own mirror', () => {
    // Same before-vector treatment, on the transform the rewrite sits after.
    // Order does not matter here and the test says why: mirroring three
    // periods gives three periods back, so expanding-then-mirroring and
    // mirroring-then-expanding are the same list. Asserted rather than
    // reasoned, because "obviously commutes" is how the next character added
    // to this rewrite gets it wrong.
    const BEFORE_MIRRORED = ['…ad', '…nuslo', '่มไ…าห', '…ad', '่มไ…าห', '…ad', '…ілак', '…ad']

    const mirrored = gen({ reverse: true, length: 8 })
    const words = generateWords(dict, makeSeedContext(dict, 11, mirrored))._unsafeUnwrap().words

    expect(words).toEqual(BEFORE_MIRRORED.map(expandEllipsis))
    expect(words).toContain('...ілак')
    for (const word of words) expect(word).not.toContain('…')
  })
})

// ── End to end: the run that used to be unwinnable ────────────────────────────

describe('a quote with an ellipsis can be finished by typing periods', () => {
  const TEXT = 'калі… нова'
  const coreCfg: CoreConfig = {
    mode: 'quote',
    durationMs: 600_000,
    maxExtraChars: 20,
    difficulty: 'normal',
    nospace: false,
    minWpm: 0
  }

  const typeAll = (words: readonly string[]): EventLog => {
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (let i = 0; i < words.length; i++) {
      for (const ch of words[i]) {
        events.push(insertEvent(seq++, t, ch))
        t += 90 + (seq % 7) * 11
      }
      events.push(commitEvent(seq++, t))
      t += 70
    }
    return { version: EVENT_LOG_VERSION, events }
  }

  it('folds to a finished run with the periods counted correct', () => {
    const words = targetsOf(TEXT)
    expect(words).toEqual(['калі...', 'нова'])

    const log = typeAll(words)
    const folded = foldLog({ config: coreCfg, words }, log.events, undefined)
    expect(folded.isOk()).toBe(true)
    const state = folded._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.input.slice(0, 2)).toEqual(['калі...', 'нова'])
  })

  it('validates on the server path with no mismatch to report', () => {
    const source = quoteSource(TEXT)
    const generation = gen({ mode: 'quote', length: 0, textSource: source })
    const words = targetsOf(TEXT)
    const snapshot: ConfigSnapshot = { config: coreCfg, generation }

    const report = validateLog({
      seed: 1,
      dictionary: dict,
      dictVersion: dictVersion([TEXT]),
      configSnapshot: snapshot,
      log: typeAll(words)
    })
    expect(report.isOk()).toBe(true)
    const value = report._unsafeUnwrap()
    expect(value.verdict).toBe('valid')
    // Perfect run: every keystroke landed on a target position, so the
    // ellipsis positions are being compared against periods and agreeing.
    expect(value.metrics.accuracy).toBe(1)
    expect(value.metrics.chars.incorrect).toBe(0)
  })

  it('is what the OLD tokenization could not do — the ellipsis was untypeable', () => {
    // The pre-change targets, reconstructed by hand: the raw text split on
    // spaces. Typing a period where the target holds `…` is an error, and no
    // sequence of keystrokes makes the word right.
    const oldWords = TEXT.split(' ')
    expect(oldWords).toEqual(['калі…', 'нова'])

    const log = typeAll(['калі...', 'нова'])
    const folded = foldLog({ config: coreCfg, words: oldWords }, log.events, undefined)
    // It still FOLDS — a wrong character is a legal event — but the word is
    // wrong, which is the accuracy and the metric mismatch the run came back
    // with. `maxExtraChars` is what stops it running away entirely.
    expect(folded.isOk()).toBe(true)
    expect(folded._unsafeUnwrap().input[0]).not.toBe(oldWords[0])
  })
})

// ── The other half: guillemets are an equivalence, not a rewrite ──────────────

describe('guillemets type as the double quote the keyboard has', () => {
  it('accepts a typed " against either direction', () => {
    expect(areGraphemesEquivalent('"', '«')).toBe(true)
    expect(areGraphemesEquivalent('"', '»')).toBe(true)
    expect(normalizeGrapheme('"', '«')).toBe('«')
    expect(normalizeGrapheme('"', '»')).toBe('»')
  })

  it('did not break the double quotes that were already there', () => {
    for (const expected of ['"', '”', '“', '„']) {
      expect(normalizeGrapheme('"', expected)).toBe(expected)
    }
    // And the group is symmetric, as every group is: a player whose layout DOES
    // have guillemets is not punished for using them.
    expect(normalizeGrapheme('«', '"')).toBe('"')
    expect(normalizeGrapheme('»', '“')).toBe('“')
  })

  it('leaves an unrelated target alone, so the group did not become a wildcard', () => {
    expect(normalizeGrapheme('"', 'a')).toBe('"')
    expect(normalizeGrapheme('«', 'a')).toBe('«')
    expect(areGraphemesEquivalent('«', "'")).toBe(false)
    expect(areGraphemesEquivalent('«', '-')).toBe(false)
  })
})
