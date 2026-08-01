import { describe, expect, it } from 'vitest'

import { COMMON_ACCENTS, LANGUAGE_ACCENTS, accentsFor, replaceAccents } from '@typemore/core'

/**
 * Lazy-mode accent table (shared/core/accents). The rules are monkeytype's data;
 * the matcher is ours, and these pin the two places it deliberately differs —
 * grapheme sources and length-safe case handling.
 */
describe('replaceAccents — common table', () => {
  it('strips diacritics from latin words', () => {
    expect(replaceAccents('épée')).toBe('epee')
    expect(replaceAccents('naïve')).toBe('naive')
    expect(replaceAccents('żółć')).toBe('zolc')
  })

  it('expands the one-to-many rules', () => {
    expect(replaceAccents('straße')).toBe('strasse')
    expect(replaceAccents('cæsar')).toBe('caesar')
    expect(replaceAccents('œuvre')).toBe('oeuvre')
    expect(replaceAccents('þing')).toBe('thing')
  })

  it('leaves an unaccented word untouched, by identity', () => {
    const word = 'keyboard'
    expect(replaceAccents(word)).toBe(word)
  })

  it('rewrites cyrillic ё, the pair normalize.ts forgives on input', () => {
    expect(replaceAccents('ёж')).toBe('еж')
  })

  it('drops the arabic harakat instead of replacing them', () => {
    // kataba, fully vocalised → the bare consonant skeleton.
    expect(replaceAccents('كَتَبَ')).toBe('كتب')
    // The hamza forms collapse onto bare alef.
    expect(replaceAccents('أَحْمَد')).toBe('احمد')
  })

  it('strips the greek tonos', () => {
    expect(replaceAccents('άνθρωπος')).toBe('ανθρωπος')
  })
})

describe('replaceAccents — case', () => {
  it('keeps the case of a one-to-one replacement', () => {
    expect(replaceAccents('Éclair')).toBe('Eclair')
    expect(replaceAccents('ÉCLAIR')).toBe('ECLAIR')
  })

  it('gives an expansion the case of the following character', () => {
    // The rule monkeytype's index-into-toUpperCase() version got right and then
    // broke for the very character it exists for.
    expect(replaceAccents('Äpfel', 'german')).toBe('Aepfel')
    expect(replaceAccents('ÄPFEL', 'german')).toBe('AEPFEL')
  })

  it('survives a character whose upper-case form is longer than itself', () => {
    // 'ß'.toUpperCase() is 'SS': indexing the upper-cased word desynchronises
    // every character after it, which is what this matcher must not do.
    expect(replaceAccents('Straße')).toBe('Strasse')
    expect(replaceAccents('Straßen-Café')).toBe('Strassen-Cafe')
  })

  it('falls back to lower case past the end of the word', () => {
    expect(replaceAccents('Fuß')).toBe('Fuss')
  })
})

describe('replaceAccents — language packs', () => {
  it('spells the german umlauts out instead of dropping them', () => {
    expect(replaceAccents('schön')).toBe('schon')
    expect(replaceAccents('schön', 'german')).toBe('schoen')
    expect(replaceAccents('grüßen', 'german')).toBe('gruessen')
  })

  it('resolves a sized variant to its base pack', () => {
    expect(replaceAccents('schön', 'german_1k')).toBe('schoen')
    expect(replaceAccents('schön', 'german_250k')).toBe('schoen')
    // Prefix match is on the sized-variant boundary, not a substring.
    expect(replaceAccents('schön', 'germanic')).toBe('schon')
  })

  it('lets a pack override the common rule for the same character', () => {
    // đ is 'd' in general, 'dj' in Serbian; þ is 'th' in general, 'p' in Quenya.
    expect(replaceAccents('đak')).toBe('dak')
    expect(replaceAccents('đak', 'serbian_latin')).toBe('djak')
    expect(replaceAccents('þan')).toBe('than')
    expect(replaceAccents('þan', 'quenya')).toBe('pan')
  })

  it('writes pinyin ü as v', () => {
    expect(replaceAccents('lǜ', 'pinyin')).toBe('lv')
    expect(replaceAccents('hǎo', 'pinyin')).toBe('hao')
  })

  it('strips vietnamese stacked marks', () => {
    expect(replaceAccents('tiếng Việt', 'vietnamese')).toBe('tieng Viet')
    expect(replaceAccents('đường', 'vietnamese')).toBe('duong')
  })
})

describe('replaceAccents — grapheme sources', () => {
  it('matches a base letter plus a combining mark as ONE source', () => {
    // ą + U+0301. monkeytype's code-point spread turns the bare mark into a
    // letter of its own; here the pair is a single source and yields one 'a'.
    expect(replaceAccents('ą́')).toBe('a')
    expect(replaceAccents('g̃')).toBe('g')
  })

  it('prefers the longest source at a position', () => {
    // Yiddish alef+patah must beat the bare alef it starts with.
    expect(replaceAccents('אַ', 'yiddish')).toBe('א')
    // The ligature expands to two letters rather than collapsing to one.
    expect(replaceAccents('ײַ', 'yiddish')).toBe('יי')
  })
})

describe('accentsFor', () => {
  it('returns the common table for a language with no pack', () => {
    expect(accentsFor('english')).toBe(COMMON_ACCENTS)
    expect(accentsFor(undefined)).toBe(COMMON_ACCENTS)
  })

  it('appends the pack after the common table, so the pack wins', () => {
    const rules = accentsFor('german')
    expect(rules.length).toBe(COMMON_ACCENTS.length + LANGUAGE_ACCENTS.german.length)
    expect(rules.slice(COMMON_ACCENTS.length)).toEqual(LANGUAGE_ACCENTS.german)
  })
})

describe('the table is well-formed', () => {
  it('never repeats a source inside one pack', () => {
    for (const [name, pack] of Object.entries({ common: COMMON_ACCENTS, ...LANGUAGE_ACCENTS })) {
      const sources = pack.flatMap((rule) => rule.from)
      expect(new Set(sources).size, `${name} repeats a source`).toBe(sources.length)
    }
  })

  it('never maps a source to itself', () => {
    for (const [name, pack] of Object.entries({ common: COMMON_ACCENTS, ...LANGUAGE_ACCENTS })) {
      for (const rule of pack) {
        expect(rule.from, `${name} maps a source to itself`).not.toContain(rule.to)
      }
    }
  })

  it('is idempotent — a stripped word has nothing left to strip', () => {
    for (const language of [undefined, ...Object.keys(LANGUAGE_ACCENTS)]) {
      for (const rule of accentsFor(language)) {
        for (const source of rule.from) {
          const once = replaceAccents(source, language)
          expect(replaceAccents(once, language), `${source} under ${language}`).toBe(once)
        }
      }
    }
  })
})
