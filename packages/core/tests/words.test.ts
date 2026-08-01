import { describe, expect, it } from 'vitest'

import {
  type Dictionary,
  type GenerationConfig,
  type GenerationTextSource,
  dictVersion,
  generateWords,
  makeSeedContext,
  mulberry32,
  replaceAccents,
  reverseWord
} from '@typemore/core'

/** A resolved quote textSource for the fixed-text branch of `generateWords`. */
const quoteSource = (text: string): GenerationTextSource => ({
  kind: 'quote',
  quoteId: 'q',
  quoteHash: dictVersion([text]),
  text
})

const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
}

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 10,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()])
  })

  it('diverges across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
})

describe('dictVersion (content hash)', () => {
  it('changes when a word is swapped at equal count', () => {
    expect(dictVersion(['a', 'x', 'c'])).not.toEqual(dictVersion(['a', 'b', 'c']))
  })

  it('is sensitive to word boundaries', () => {
    expect(dictVersion(['ab', 'c'])).not.toEqual(dictVersion(['a', 'bc']))
  })
})

describe('generateWords', () => {
  it('same seed + dictionary version => identical list', () => {
    const context = makeSeedContext(dict, 42, gen())
    const a = generateWords(dict, context)._unsafeUnwrap()
    const b = generateWords(dict, context)._unsafeUnwrap()
    expect(a.words).toEqual(b.words)
    expect(a.words).toHaveLength(10)
  })

  it('different seed => different list', () => {
    const a = generateWords(dict, makeSeedContext(dict, 1, gen()))._unsafeUnwrap()
    const b = generateWords(dict, makeSeedContext(dict, 2, gen()))._unsafeUnwrap()
    expect(a.words).not.toEqual(b.words)
  })

  it('generation config is part of the seed identity', () => {
    const plain = generateWords(dict, makeSeedContext(dict, 7, gen()))._unsafeUnwrap()
    const punctuated = generateWords(
      dict,
      makeSeedContext(dict, 7, gen({ punctuation: true }))
    )._unsafeUnwrap()
    expect(punctuated.words).not.toEqual(plain.words)
  })

  it('rejects a dictionary whose content no longer matches the seed context', () => {
    const context = makeSeedContext(dict, 42, gen())
    const mutated: Dictionary = { ...dict, words: [...dict.words.slice(0, -1), 'india'] }
    const res = generateWords(mutated, context)
    expect(res.isErr()).toBe(true)
    expect(res._unsafeUnwrapErr().kind).toBe('DictVersionMismatch')
  })

  it('rejects an empty dictionary', () => {
    const empty: Dictionary = { name: 'x', bcp47: 'en', words: [] }
    expect(generateWords(empty, makeSeedContext(empty, 1, gen()))._unsafeUnwrapErr().kind).toBe(
      'EmptyDictionary'
    )
  })
})

describe('random case transform', () => {
  it('same seed + randomCase => identical list', () => {
    const context = makeSeedContext(dict, 5, gen({ randomCase: true }))
    expect(generateWords(dict, context)._unsafeUnwrap().words).toEqual(
      generateWords(dict, context)._unsafeUnwrap().words
    )
  })

  it('changes output vs randomCase off (same seed)', () => {
    const plain = generateWords(dict, makeSeedContext(dict, 5, gen()))._unsafeUnwrap().words
    const cased = generateWords(
      dict,
      makeSeedContext(dict, 5, gen({ randomCase: true }))
    )._unsafeUnwrap().words
    expect(cased).not.toEqual(plain)
  })

  it('only recases letters — lowercasing yields dictionary words', () => {
    const cased = generateWords(
      dict,
      makeSeedContext(dict, 5, gen({ randomCase: true }))
    )._unsafeUnwrap().words
    expect(cased.every((w) => dict.words.includes(w.toLowerCase()))).toBe(true)
  })
})

describe('reverse mod', () => {
  const SEEDS = [1, 7, 42, 128, 999]

  it.each(SEEDS)('same seed ± reverse => exactly mirrored targets (seed %i)', (seed) => {
    const plain = generateWords(dict, makeSeedContext(dict, seed, gen()))._unsafeUnwrap().words
    const reversed = generateWords(
      dict,
      makeSeedContext(dict, seed, gen({ reverse: true }))
    )._unsafeUnwrap().words
    expect(reversed).toHaveLength(plain.length)
    for (let i = 0; i < plain.length; i++) expect(reversed[i]).toBe(reverseWord(plain[i]))
  })

  it('mirrors exactly even with punctuation + numbers + randomCase (PRNG/caps unperturbed)', () => {
    const opts = { punctuation: true, numbers: true, randomCase: true }
    const plain = generateWords(dict, makeSeedContext(dict, 314, gen(opts)))._unsafeUnwrap().words
    const reversed = generateWords(
      dict,
      makeSeedContext(dict, 314, gen({ ...opts, reverse: true }))
    )._unsafeUnwrap().words
    for (let i = 0; i < plain.length; i++) expect(reversed[i]).toBe(reverseWord(plain[i]))
  })

  it('reverseWord mirrors by code point', () => {
    expect(reverseWord('abc')).toBe('cba')
    expect(reverseWord('')).toBe('')
  })
})

describe('lazy mode', () => {
  const accented: Dictionary = {
    name: 'accented',
    bcp47: 'de',
    words: ['schön', 'straße', 'épée', 'grüßen', 'naïve', 'żółć', 'cæsar', 'über']
  }

  const SEEDS = [1, 7, 42, 128, 999]

  it.each(SEEDS)('same seed ± lazy => aligned lists, accents stripped (seed %i)', (seed) => {
    const plain = generateWords(
      accented,
      makeSeedContext(accented, seed, gen())
    )._unsafeUnwrap().words
    const stripped = generateWords(
      accented,
      makeSeedContext(accented, seed, gen({ lazy: true }))
    )._unsafeUnwrap().words
    expect(stripped).toHaveLength(plain.length)
    for (let i = 0; i < plain.length; i++) expect(stripped[i]).toBe(replaceAccents(plain[i]))
  })

  it('stays aligned with punctuation + numbers + randomCase (PRNG unperturbed)', () => {
    // The reason lazy runs AFTER decorate: randomCase draws once per character,
    // and 'ß' → 'ss' would otherwise consume an extra draw and desync the rest.
    const opts = { punctuation: true, numbers: true, randomCase: true }
    const plain = generateWords(
      accented,
      makeSeedContext(accented, 314, gen(opts))
    )._unsafeUnwrap().words
    const stripped = generateWords(
      accented,
      makeSeedContext(accented, 314, gen({ ...opts, lazy: true }))
    )._unsafeUnwrap().words
    for (let i = 0; i < plain.length; i++) expect(stripped[i]).toBe(replaceAccents(plain[i]))
  })

  it('leaves no accented character in the output', () => {
    const words = generateWords(
      accented,
      makeSeedContext(accented, 11, gen({ lazy: true, length: 40 }))
    )._unsafeUnwrap().words
    expect(words.join('')).toMatch(/^[\x20-\x7e]*$/)
  })

  it('applies the language pack named by the generation config', () => {
    const context = (language?: string) =>
      makeSeedContext(accented, 3, gen({ lazy: true, language }))
    const common = generateWords(accented, context())._unsafeUnwrap().words
    const german = generateWords(accented, context('german'))._unsafeUnwrap().words
    // Same targets word-for-word, spelled differently: ö → o vs ö → oe.
    expect(german).not.toEqual(common)
    expect(german).toHaveLength(common.length)
    expect(common.join(' ')).toContain('schon')
    expect(german.join(' ')).toContain('schoen')
  })

  it('composes with reverse as the mirror of the stripped word', () => {
    const both = generateWords(
      accented,
      makeSeedContext(accented, 21, gen({ lazy: true, reverse: true }))
    )._unsafeUnwrap().words
    const lazyOnly = generateWords(
      accented,
      makeSeedContext(accented, 21, gen({ lazy: true }))
    )._unsafeUnwrap().words
    for (let i = 0; i < lazyOnly.length; i++) expect(both[i]).toBe(reverseWord(lazyOnly[i]))
  })

  it('is absent by default — a config without the field generates the old list', () => {
    const legacy = generateWords(accented, makeSeedContext(accented, 8, gen()))._unsafeUnwrap()
    const explicit = generateWords(
      accented,
      makeSeedContext(accented, 8, gen({ lazy: false }))
    )._unsafeUnwrap()
    expect(explicit.words).toEqual(legacy.words)
    expect(legacy.words.join(' ')).toContain('ß')
  })

  it('does not touch a verbatim source — raw tokens stay as authored', () => {
    const code: Dictionary = { name: 'code', bcp47: 'en', words: ['café();', 'straße,'] }
    const words = generateWords(
      code,
      makeSeedContext(code, 4, gen({ lazy: true, rawTokens: true }))
    )._unsafeUnwrap().words
    expect(words.every((w) => code.words.includes(w))).toBe(true)
  })

  it('does not touch a quote — the text is the author’s', () => {
    const text = 'un café très chaud'
    const words = generateWords(
      dict,
      makeSeedContext(dict, 4, gen({ lazy: true, textSource: quoteSource(text) }))
    )._unsafeUnwrap().words
    expect(words).toEqual(['un', 'café', 'très', 'chaud'])
  })
})

/**
 * Code dictionaries ship their own case, punctuation and layout (`\t` head,
 * `\n` tail), so `rawTokens` turns every decorate transform off. The flag lives
 * in `GenerationConfig` — it changes generation, so the seed context and every
 * replay must see it (slot invariant, docs/game-architecture.md).
 */
describe('rawTokens (code dictionaries)', () => {
  const codeDict: Dictionary = {
    name: 'code_test',
    bcp47: 'en',
    words: ['const', 'x', '=', '42;\n', '\tconsole.log(x);\n', '}', 'function', 'greet(name)']
  }
  const rawGen = (over: Partial<GenerationConfig> = {}): GenerationConfig =>
    gen({ rawTokens: true, ...over })

  it('same seed twice => identical targets', () => {
    const context = makeSeedContext(codeDict, 42, rawGen())
    const a = generateWords(codeDict, context)._unsafeUnwrap().words
    const b = generateWords(codeDict, context)._unsafeUnwrap().words
    expect(a).toEqual(b)
    expect(a).toHaveLength(10)
  })

  it('emits dictionary tokens verbatim, layout characters included', () => {
    const words = generateWords(
      codeDict,
      makeSeedContext(codeDict, 3, rawGen({ punctuation: true, numbers: true, randomCase: true }))
    )._unsafeUnwrap().words

    // Every target is a token of the dictionary — no appended mark, no recasing,
    // no digit substitution: `);\n` survives exactly as authored.
    expect(words.every((word) => codeDict.words.includes(word))).toBe(true)
  })

  it('ignores the reverse mirror as well', () => {
    const straight = generateWords(codeDict, makeSeedContext(codeDict, 11, rawGen()))
      ._unsafeUnwrap()
      .words.join('|')
    const reversed = generateWords(
      codeDict,
      makeSeedContext(codeDict, 11, rawGen({ reverse: true }))
    )
      ._unsafeUnwrap()
      .words.join('|')
    expect(reversed).toBe(straight)
  })

  it('leaves the flag-off behaviour untouched (legacy default)', () => {
    const omitted = generateWords(dict, makeSeedContext(dict, 7, gen({ punctuation: true })))
      ._unsafeUnwrap()
      .words.join('|')
    const explicitOff = generateWords(
      dict,
      makeSeedContext(dict, 7, gen({ punctuation: true, rawTokens: false }))
    )
      ._unsafeUnwrap()
      .words.join('|')
    expect(explicitOff).toBe(omitted)
  })

  it('is part of the seed identity: raw and decorated lists differ', () => {
    const decorated = generateWords(
      codeDict,
      makeSeedContext(codeDict, 5, gen({ punctuation: true, randomCase: true }))
    )._unsafeUnwrap().words
    const raw = generateWords(
      codeDict,
      makeSeedContext(codeDict, 5, rawGen({ punctuation: true, randomCase: true }))
    )._unsafeUnwrap().words
    expect(raw).not.toEqual(decorated)
  })
})
