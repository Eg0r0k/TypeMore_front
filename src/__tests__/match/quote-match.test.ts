import { describe, expect, it } from 'vitest'

import { isQuoteMatch, matchGeneration } from '@/entities/match/model/match-setup'
import type { RoomSettings } from '@shared/match-transport'
import { emitsRawTokens } from '@shared/core'

/**
 * A quote match takes the OTHER text path (PROTOCOL.md §5, QUOTES.md): the id
 * travels, the bytes are fetched per client, and nothing is generated. What is
 * worth pinning is that the generation config says so — because the same
 * predicate the core uses to skip the transforms (`emitsRawTokens`) is what
 * decides whether the shared text mods are applied and paid for.
 */
const settings = (patch: Partial<RoomSettings> = {}): RoomSettings => ({
  name: 'room',
  visibility: 'private',
  mode: 'words',
  wordCount: 25,
  lang: 'russian',
  dictHash: 'e2e00002',
  textMods: { punctuation: true, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' },
  ...patch
})

const quoteSettings = (patch: Partial<RoomSettings> = {}): RoomSettings =>
  settings({
    mode: 'quote',
    wordCount: 6,
    dictHash: '',
    textSource: { kind: 'quote', quoteId: 'q-1' },
    ...patch
  })

const TEXT = { kind: 'quote', quoteId: 'q-1', quoteHash: 'abcd1234', text: 'a b c d e f' } as const

describe('quote matches', () => {
  it('recognises the source, not the mode', () => {
    expect(isQuoteMatch(quoteSettings())).toBe(true)
    expect(isQuoteMatch(settings())).toBe(false)
  })

  it('carries the resolved text and claims no length of its own', () => {
    const generation = matchGeneration(quoteSettings(), TEXT)

    expect(generation).not.toBeNull()
    expect(generation?.textSource).toEqual(TEXT)
    // A quote ends at the end of its text; a magnitude here would be a second
    // definition of when the run is over.
    expect(generation?.length).toBe(0)
    expect(emitsRawTokens(generation!)).toBe(true)
  })

  it('still needs a word count — the server scales the counted deadline by it', () => {
    expect(matchGeneration(quoteSettings({ wordCount: undefined }), TEXT)).toBeNull()
  })

  it('leaves the seeded arm exactly as it was', () => {
    const generation = matchGeneration(settings())

    expect(generation?.length).toBe(25)
    expect(generation?.textSource).toBeUndefined()
    expect(generation?.punctuation).toBe(true)
    expect(emitsRawTokens(generation!)).toBe(false)
  })

  it('keeps the time arm keyed on duration, in seconds', () => {
    const generation = matchGeneration(
      settings({ mode: 'time', durationMs: 30000, wordCount: undefined })
    )

    expect(generation?.length).toBe(30)
    expect(matchGeneration(settings({ mode: 'time', durationMs: undefined }))).toBeNull()
  })
})
