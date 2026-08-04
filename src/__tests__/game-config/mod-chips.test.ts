/**
 * The mod chips — the row that says what a run was played under.
 *
 * The bug this pins: the row is driven by an explicit FLAGS list, and a mod
 * missing from that list renders as nothing at all. `lazy` was missing from it,
 * and `reverse` — present here — was being dropped one layer up, in the result
 * screen's `summaryMods`. Both failures look identical to a reader: a mod that
 * was ON reports as OFF, on the solo result screen and on the match one.
 *
 * So the assertion worth having is not "these two draw" but "every boolean mod
 * the registry offers can draw", which is what stops the next one from being
 * forgotten.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@app/i18n'
import { GameModIcons } from '@/entities/game'
import { optionsFor } from '@/entities/game/config/registry'

const chipsFor = (mods: Record<string, unknown>) =>
  mount(GameModIcons, { props: { mods }, global: { plugins: [i18n] } })

describe('mod chips', () => {
  it('draws every text mod that was on', () => {
    const wrapper = chipsFor({
      punctuation: true,
      numbers: true,
      randomCase: true,
      reverse: true,
      lazy: true
    })
    expect(wrapper.findAll('li')).toHaveLength(5)
  })

  it('draws lazy and reverse specifically, by their own names', () => {
    for (const mod of ['lazy', 'reverse'] as const) {
      const wrapper = chipsFor({ [mod]: true })
      const chip = wrapper.find('li')
      expect(chip.exists(), `${mod} must render a chip`).toBe(true)
      expect(chip.text() || chip.find('[aria-label]').attributes('aria-label')).toBe(
        i18n.global.t(`game.${mod}`)
      )
    }
  })

  it('can draw every boolean mod the game offers', () => {
    // The registry is the list of mods that EXIST; the chip row's own FLAGS
    // list is a hand-written subset of it, and this is what catches the next
    // mod that gets added to one and not the other.
    const booleanMods = [...optionsFor('solo'), ...optionsFor('freemod')]
      .filter((option) => option.control.kind === 'boolean')
      .map((option) => option.key)

    const keys = new Set(booleanMods)
    // A vacuous loop would pass this test while proving nothing.
    expect(keys.size).toBeGreaterThanOrEqual(5)

    for (const key of keys) {
      const wrapper = chipsFor({ [key]: true })
      expect(wrapper.findAll('li'), `no chip for "${key}"`).toHaveLength(1)
    }
  })

  it('says nothing about a mod that was off', () => {
    expect(chipsFor({ lazy: false, reverse: false }).findAll('li')).toHaveLength(0)
    // `normal` difficulty is the ABSENCE of a mod, not a mod called normal.
    expect(chipsFor({ difficulty: 'normal', minWpm: 0 }).findAll('li')).toHaveLength(0)
  })
})
