/**
 * Mods → chips is the CLIENT's projection of the raw flags (LEADERBOARDS.md:
 * the server deliberately ships no display distillation). What it must never do
 * is invent a mod: `difficulty: 'normal'` and `minWpm: 0` are the ABSENCE of a
 * mod, and a board row played plain has no chips at all.
 *
 * Since the icon rework the binary mods render as glyphs and the WORD lives in
 * the chip's tooltip and its trigger's aria-label — so the label assertions
 * read aria-labels, and a flag chip must actually carry an svg.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

import type { BoardMods } from '@shared/api'
import { i18n } from '@app/i18n'
import { BoardModChips } from '@/features/leaderboards'

const PLAIN: BoardMods = {
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  nospace: false,
  difficulty: 'normal',
  minWpm: 0,
  blind: false,
  fading: false,
  flashlight: false
}

const mountChips = (mods: BoardMods) =>
  mount(BoardModChips, { props: { mods }, global: { plugins: [i18n] } })

const chipTitles = (mods: BoardMods): string[] => {
  const wrapper = mountChips(mods)
  const titles = wrapper.findAll('li button').map((chip) => chip.attributes('aria-label') ?? '')
  wrapper.unmount()
  return titles
}

beforeEach(() => {
  i18n.global.locale.value = 'en'
})

describe('board mod chips', () => {
  it('renders nothing at all for a run with no mods on', () => {
    const wrapper = mountChips(PLAIN)

    // Not an empty list, not a "normal" chip — nothing.
    expect(wrapper.find('[data-testid="boards-mods"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')

    wrapper.unmount()
  })

  it('never turns normal difficulty or a zero wpm floor into a chip', () => {
    expect(chipTitles({ ...PLAIN, difficulty: 'normal', minWpm: 0, punctuation: true })).toEqual([
      'punctuation'
    ])
  })

  it('chips difficulty only above normal, and the wpm floor only above zero', () => {
    expect(chipTitles({ ...PLAIN, difficulty: 'expert' })).toEqual(['expert'])
    expect(chipTitles({ ...PLAIN, difficulty: 'master', minWpm: 40 })).toEqual([
      'master',
      'min speed 40'
    ])
  })

  it('chips exactly the boolean flags that are on', () => {
    expect(
      chipTitles({
        ...PLAIN,
        punctuation: true,
        numbers: false,
        randomCase: true,
        blind: true,
        flashlight: false
      })
    ).toEqual(['punctuation', 'random case', 'blind'])
  })

  it('uses the game’s own labels rather than board-only copy', () => {
    const titles = chipTitles({ ...PLAIN, nospace: true, reverse: true, fading: true })

    expect(titles).toEqual([
      i18n.global.t('game.nospace'),
      i18n.global.t('game.reverse'),
      i18n.global.t('game.fading')
    ])
  })

  it('draws a boolean mod as a glyph whose accessible name is the word', () => {
    const wrapper = mountChips({ ...PLAIN, flashlight: true })
    const chip = wrapper.find('li button')

    expect(chip.find('svg').exists()).toBe(true)
    expect(chip.attributes('aria-label')).toBe(i18n.global.t('game.flashlight'))
    // Icon-only: the word is the tooltip/aria-label, never visible text.
    expect(chip.text()).toBe('')

    wrapper.unmount()
  })

  it('keeps difficulty as text — expert and master share the flame otherwise', () => {
    const wrapper = mountChips({ ...PLAIN, difficulty: 'expert' })
    expect(wrapper.find('li button').text()).toBe('expert')
    wrapper.unmount()
  })
})
