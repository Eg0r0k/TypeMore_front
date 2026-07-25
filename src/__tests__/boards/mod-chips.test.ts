/**
 * Mods → chips is the CLIENT's projection of the raw flags (LEADERBOARDS.md:
 * the server deliberately ships no display distillation). What it must never do
 * is invent a mod: `difficulty: 'normal'` and `minWpm: 0` are the ABSENCE of a
 * mod, and a board row played plain has no chips at all.
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

const chipTexts = (mods: BoardMods): string[] => {
  const wrapper = mountChips(mods)
  const texts = wrapper.findAll('li').map((chip) => chip.text())
  wrapper.unmount()
  return texts
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
    expect(chipTexts({ ...PLAIN, difficulty: 'normal', minWpm: 0, punctuation: true })).toEqual([
      'punctuation'
    ])
  })

  it('chips difficulty only above normal, and the wpm floor only above zero', () => {
    expect(chipTexts({ ...PLAIN, difficulty: 'expert' })).toEqual(['expert'])
    expect(chipTexts({ ...PLAIN, difficulty: 'master', minWpm: 40 })).toEqual([
      'master',
      'min speed 40'
    ])
  })

  it('chips exactly the boolean flags that are on', () => {
    expect(
      chipTexts({
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
    const texts = chipTexts({ ...PLAIN, nospace: true, reverse: true, fading: true })

    expect(texts).toEqual([
      i18n.global.t('game.nospace'),
      i18n.global.t('game.reverse'),
      i18n.global.t('game.fading')
    ])
  })
})
