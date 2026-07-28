/**
 * The rail's derivations: everything it offers must be traceable to a REAL
 * board in the catalogue, because the client cannot mint a language bucket key
 * (the key format has exactly one producer, and it is on the server).
 */
import { describe, expect, it } from 'vitest'

import type { BucketInfo } from '@shared/api'
import { bucketForLanguage, railLanguages, railVariations } from '@/features/leaderboards'

const lang = (
  key: string,
  mode: 'time' | 'words',
  dimension: number,
  language: string,
  entries: number
): BucketInfo => ({
  bucket: key,
  mode,
  ...(mode === 'time' ? { durationMs: dimension } : { wordCount: dimension }),
  lang: language,
  textSource: 'seeded',
  entries
})

const TIME_15_EN = lang('time:15000:english:seeded', 'time', 15_000, 'english', 3)
const TIME_60_EN = lang('time:60000:english:seeded', 'time', 60_000, 'english', 9)
const WORDS_25_EN = lang('words:25:english:seeded', 'words', 25, 'english', 5)
const TIME_60_RU = lang('time:60000:russian:seeded', 'time', 60_000, 'russian', 2)
const QUOTE = {
  bucket: 'quote:0a6c0103-89c8-43be-bd66-1371216d4a53',
  quoteId: '0a6c0103-89c8-43be-bd66-1371216d4a53',
  entries: 99
} satisfies BucketInfo

const CATALOGUE = [TIME_15_EN, TIME_60_EN, WORDS_25_EN, TIME_60_RU, QUOTE]

const DICTIONARIES = [
  { lang: 'english', name: 'English' },
  { lang: 'russian', name: 'Russian' },
  { lang: 'german', name: 'German' }
]

describe('railLanguages', () => {
  it('lists the dictionary catalogue’s names with per-language entry totals', () => {
    const rows = railLanguages(CATALOGUE, DICTIONARIES)

    expect(rows).toEqual([
      { key: 'english', name: 'English', entries: 17 },
      { key: 'german', name: 'German', entries: 0 },
      { key: 'russian', name: 'Russian', entries: 2 }
    ])
  })

  it('keeps a board whose dictionary is gone, under its key', () => {
    const rows = railLanguages([TIME_60_RU], [{ lang: 'english', name: 'English' }])

    expect(rows).toEqual([
      { key: 'english', name: 'English', entries: 0 },
      { key: 'russian', name: 'russian', entries: 2 }
    ])
  })

  it('derives no language from a quote board', () => {
    const rows = railLanguages([QUOTE], DICTIONARIES)

    expect(rows.every((row) => row.entries === 0)).toBe(true)
    expect(rows.map((row) => row.key)).not.toContain(QUOTE.bucket)
  })
})

describe('railVariations', () => {
  it('offers exactly the presets the catalogue holds, time first then words', () => {
    const chips = railVariations(CATALOGUE, 'english')

    expect(chips.map((chip) => chip.id)).toEqual(['time:15000', 'time:60000', 'words:25'])
    expect(chips.map((chip) => chip.entries)).toEqual([3, 9, 5])
    expect(chips.map((chip) => chip.bucket)).toEqual([
      TIME_15_EN.bucket,
      TIME_60_EN.bucket,
      WORDS_25_EN.bucket
    ])
  })

  it('mutes a preset the selected language has no board for: zero count, no key', () => {
    const chips = railVariations(CATALOGUE, 'russian')

    // russian has only the 60s board; the other two presets exist in the
    // catalogue (english plays them) and are listed as evidence, not links.
    expect(chips.map((chip) => [chip.id, chip.entries, chip.bucket])).toEqual([
      ['time:15000', 0, undefined],
      ['time:60000', 2, TIME_60_RU.bucket],
      ['words:25', 0, undefined]
    ])
  })

  it('invents nothing when the catalogue is empty', () => {
    expect(railVariations([], 'english')).toEqual([])
    expect(railVariations([QUOTE], 'english')).toEqual([])
  })
})

describe('bucketForLanguage', () => {
  it('keeps the preset the visitor was on when the new language has it', () => {
    expect(bucketForLanguage(CATALOGUE, 'russian', TIME_60_EN.bucket)).toBe(TIME_60_RU.bucket)
  })

  it('falls back to the language’s busiest board', () => {
    expect(bucketForLanguage(CATALOGUE, 'english', TIME_60_RU.bucket)).toBe(TIME_60_EN.bucket)
    expect(bucketForLanguage(CATALOGUE, 'english', undefined)).toBe(TIME_60_EN.bucket)
  })

  it('answers nothing for a language with no boards', () => {
    expect(bucketForLanguage(CATALOGUE, 'german', TIME_60_EN.bucket)).toBeUndefined()
  })
})
