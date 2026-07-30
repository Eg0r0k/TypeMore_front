import { describe, expect, it } from 'vitest'

import {
  EQUIVALENCE_GROUPS,
  areGraphemesEquivalent,
  isSpaceGrapheme,
  makeNormalizer,
  normalizeGrapheme
} from '@typemore/core'

/**
 * Visual-equivalence registry (shared/core/normalize). The behaviour mirrors
 * monkeytype's areCharactersVisuallyEqual/normalizeData; the registry shape is
 * ours — these pin both the default rules and the extension mechanism.
 */
describe('areGraphemesEquivalent — default registry', () => {
  it('accepts typographic variants of the same character everywhere', () => {
    expect(areGraphemesEquivalent('-', '—')).toBe(true)
    expect(areGraphemesEquivalent('–', '‐')).toBe(true)
    expect(areGraphemesEquivalent("'", '’')).toBe(true)
    expect(areGraphemesEquivalent('"', '„')).toBe(true)
    expect(areGraphemesEquivalent(',', '‚')).toBe(true)
  })

  it('treats every typable space variant as the separator', () => {
    expect(areGraphemesEquivalent('　', ' ')).toBe(true)
    expect(areGraphemesEquivalent(' ', ' ')).toBe(true)
    expect(isSpaceGrapheme('　')).toBe(true)
    expect(isSpaceGrapheme('x')).toBe(false)
  })

  it('scopes language groups to their dictionary, sized variants included', () => {
    expect(areGraphemesEquivalent('е', 'ё', 'russian')).toBe(true)
    expect(areGraphemesEquivalent('e', 'ё', 'russian_1k')).toBe(true)
    // No language, or another language: the group does not apply.
    expect(areGraphemesEquivalent('е', 'ё')).toBe(false)
    expect(areGraphemesEquivalent('е', 'ё', 'english')).toBe(false)
    // Prefix match is on the sized-variant boundary, not a substring.
    expect(areGraphemesEquivalent('е', 'ё', 'russiannot')).toBe(false)
  })

  it('rejects unrelated characters', () => {
    expect(areGraphemesEquivalent('a', 'b')).toBe(false)
    expect(areGraphemesEquivalent('-', "'")).toBe(false)
  })
})

describe('normalizeGrapheme', () => {
  it('stores the EXPECTED character when the typed one is its variant', () => {
    expect(normalizeGrapheme('-', '—')).toBe('—')
    expect(normalizeGrapheme('е', 'ё', 'russian')).toBe('ё')
    expect(normalizeGrapheme("'", '’')).toBe('’')
  })

  it('leaves a genuinely wrong grapheme untouched', () => {
    expect(normalizeGrapheme('b', 'a')).toBe('b')
    expect(normalizeGrapheme('е', 'ё', 'english')).toBe('е')
  })

  it('falls back to the canonical member when the target is outside the group', () => {
    // An exotic space against a letter target still becomes the plain space.
    expect(normalizeGrapheme('　', 'a')).toBe(' ')
    expect(normalizeGrapheme(' ', undefined)).toBe(' ')
    // Groups without a canonical stay as typed.
    expect(normalizeGrapheme('—', 'a')).toBe('—')
  })
})

describe('makeNormalizer — the extension mechanism', () => {
  it('a new rule is one appended entry', () => {
    const extended = makeNormalizer([
      ...EQUIVALENCE_GROUPS,
      { id: 'de-umlaut-a', chars: ['ä', 'a'], languages: ['german'] }
    ])
    expect(extended.areEquivalent('a', 'ä', 'german')).toBe(true)
    expect(extended.normalize('a', 'ä', 'german')).toBe('ä')
    // Scoped exactly like the built-ins.
    expect(extended.areEquivalent('a', 'ä', 'english')).toBe(false)
    // And the default registry is untouched.
    expect(areGraphemesEquivalent('a', 'ä', 'german')).toBe(false)
  })
})
