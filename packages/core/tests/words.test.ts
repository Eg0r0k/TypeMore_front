import { describe, expect, it } from 'vitest'

import {
  type Dictionary,
  type GenerationConfig,
  dictVersion,
  generateWords,
  makeSeedContext,
  mulberry32,
  reverseWord
} from '@shared/core'

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
