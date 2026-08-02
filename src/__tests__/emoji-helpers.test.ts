/**
 * The emoji list is edited in `emoji.ts` and shipped. What still needs pinning
 * is the RENDER path: a message is remote text, and `parseEmojis` is the one
 * function allowed to turn any of it into markup.
 */
import { describe, expect, it } from 'vitest'

import {
  EMOJI_NAME_PATTERN,
  emojis,
  parseEmojis,
  searchEmojis,
  type Emoji
} from '@/shared/lib/helpers/emoji'

const extra: Emoji[] = [
  { value: 'kekw', icon: 'https://example.com/kekw.png', text: 'KEKW' },
  ...emojis
]

describe('emoji names', () => {
  it('allows only what can sit between two colons and be found again', () => {
    expect(EMOJI_NAME_PATTERN.test('kekw')).toBe(true)
    expect(EMOJI_NAME_PATTERN.test('pepe_Chill-2')).toBe(true)

    expect(EMOJI_NAME_PATTERN.test('has space')).toBe(false)
    expect(EMOJI_NAME_PATTERN.test('with:colon')).toBe(false)
    expect(EMOJI_NAME_PATTERN.test('')).toBe(false)
    expect(EMOJI_NAME_PATTERN.test('a'.repeat(33))).toBe(false)
    // A name is interpolated into a RegExp; a metacharacter must never reach it.
    expect(EMOJI_NAME_PATTERN.test('.*')).toBe(false)
    expect(EMOJI_NAME_PATTERN.test('(a|b)')).toBe(false)
  })
})

describe('searchEmojis', () => {
  it('matches the display name and the token, case-insensitively', () => {
    expect(searchEmojis(emojis, 'pepe').map((e) => e.value)).toEqual(['pepeChill'])
    expect(searchEmojis(emojis, 'CHILL').map((e) => e.value)).toEqual(['pepeChill'])
    expect(searchEmojis(emojis, '')).toHaveLength(emojis.length)
    expect(searchEmojis(emojis, 'nothing here')).toEqual([])
  })
})

describe('parseEmojis', () => {
  it('escapes the text before it substitutes anything', () => {
    const html = parseEmojis('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders a token the reader knows and leaves one they do not', () => {
    const withOwn = parseEmojis(':kekw: :nope:', extra)
    expect(withOwn).toContain('src="https://example.com/kekw.png"')
    // A client that has never heard of `:nope:` shows exactly that.
    expect(withOwn).toContain(':nope:')

    // The same message, read by a client whose list does not have it.
    expect(parseEmojis(':kekw:')).toBe(':kekw:')
  })

  it('escapes what it interpolates', () => {
    const html = parseEmojis(':x:', [
      { value: 'x', icon: 'https://example.com/a.png?a="b', text: 'a"b' }
    ])
    expect(html).not.toContain('?a="b')
    expect(html).toContain('&quot;')
  })
})
