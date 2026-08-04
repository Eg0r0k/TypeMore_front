/**
 * Lazy mode (no diacritics) as a ROOM text mod.
 *
 * The whole risk of putting it on the wire is that it is a GENERATION-time
 * transform: every seat regenerates the words from the shared seed itself, so
 * a lazy flag that does not reach one of them, or reaches it without the
 * language that picks the accent pack, produces two different texts from the
 * same seed — the one failure a shared seed exists to prevent. These pin both
 * halves against the core's own generator, plus the scoring rule that a shared
 * text mod is never a per-player multiplier.
 */
import { describe, expect, it } from 'vitest'

import { matchGeneration, scoringGeneration } from '@/entities/match/model/match-setup'
import type { RoomSettings } from '@shared/match-transport'
import {
  type Dictionary,
  generateWords,
  makeSeedContext,
  modMultiplierV1,
  replaceAccents
} from '@typemore/core'

const NO_MODS = {
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  lazy: false
} as const

const settings = (patch: Partial<RoomSettings> = {}): RoomSettings => ({
  name: 'room',
  visibility: 'private',
  mode: 'words',
  wordCount: 8,
  lang: 'german',
  dictHash: 'e2e00003',
  textMods: NO_MODS,
  textSource: { kind: 'seeded' },
  ...patch
})

/** Umlauts throughout: German is also the language with its OWN accent pack. */
const dict: Dictionary = {
  name: 'german',
  bcp47: 'de',
  words: ['Äpfel', 'straße', 'schön', 'grüßen', 'über', 'möchte', 'weiß', 'für']
}

const wordsFor = (roomSettings: RoomSettings, seed = 7): readonly string[] => {
  const generation = matchGeneration(roomSettings)
  expect(generation).not.toBeNull()
  const generated = generateWords(dict, makeSeedContext(dict, seed, generation!))
  expect(generated.isOk()).toBe(true)
  return generated._unsafeUnwrap().words
}

describe('lazy mode in a match', () => {
  it('carries the flag AND the language, so the accent pack is the room’s own', () => {
    const generation = matchGeneration(settings({ textMods: { ...NO_MODS, lazy: true } }))
    expect(generation?.lazy).toBe(true)
    // Without this the German pack would not be selected and the umlauts would
    // be stripped the generic way (`ä` → `a`) instead of spelled out (`ae`).
    expect(generation?.language).toBe('german')
  })

  it('strips diacritics from the generated text, word for word against the plain run', () => {
    const plain = wordsFor(settings())
    const lazy = wordsFor(settings({ textMods: { ...NO_MODS, lazy: true } }))

    expect(lazy).toHaveLength(plain.length)
    expect(lazy).not.toEqual(plain)
    // The core's own contract: a lazy list is aligned word-for-word with the
    // same seed's plain list, each word being its accent-stripped form.
    expect(lazy).toEqual(plain.map((word) => replaceAccents(word, 'german')))
    // Every dictionary word here carries a diacritic, so the plain list must and
    // the lazy list must not — whichever words this seed happened to draw.
    expect(plain.join(' ')).toMatch(/[äöüßÄÖÜ]/)
    expect(lazy.join(' ')).not.toMatch(/[äöüßÄÖÜ]/)
    // German SPELLS THEM OUT rather than dropping the mark, which is the whole
    // reason the language has to travel: `ö` → `oe`, not `o`.
    expect(lazy.join(' ')).toMatch(/ae|oe|ue|ss/)
  })

  it('gives every seat the same text: the flag is the room’s, not the seat’s', () => {
    const room = settings({ textMods: { ...NO_MODS, lazy: true } })
    // Two seats, same room settings, same server seed — the only inputs a seat
    // has. Identical output is what makes the match a race and not two games.
    expect(wordsFor(room, 42)).toEqual(wordsFor(room, 42))
  })

  it('is zeroed for scoring: a shared text mod is never a per-player multiplier', () => {
    const generation = matchGeneration(settings({ textMods: { ...NO_MODS, lazy: true } }))!
    const scoring = scoringGeneration(generation)

    expect(scoring.lazy).toBe(false)
    // `language` is not a mod and survives — nothing scores off it.
    expect(scoring.language).toBe('german')
    // And the multiplier is unmoved by it either way (MATCH.md §3).
    const freemods = { difficulty: 'normal', nospace: false, minWpm: 0 } as const
    const noDeclaration = { blind: false, fading: false, flashlight: false }
    expect(modMultiplierV1({ generation: scoring, config: freemods }, noDeclaration)).toEqual(
      modMultiplierV1(
        { generation: scoringGeneration(matchGeneration(settings())!), config: freemods },
        noDeclaration
      )
    )
  })
})
