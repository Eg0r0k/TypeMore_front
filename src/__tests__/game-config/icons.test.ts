/**
 * Every option is drawn with a glyph, and four of them are drawn with NOTHING
 * ELSE — the boolean mods are icon-only. A missing icon there is not a degraded
 * label, it is an empty button, so the mapping is asserted at runtime as well as
 * by the `Record<GameOptionKey, Component>` the compiler checks.
 *
 * The second half is distinctness. `blind`, `fading` and `flashlight` are the
 * three a reader cannot tell apart from their names alone; if two of them ever
 * resolve to the same component, the icon-only row becomes unreadable in exactly
 * the place it is least recoverable.
 */
import { describe, expect, it } from 'vitest'

import { GAME_OPTIONS, OPTION_ICONS, modeIconOf, optionOf, valuesFor } from '@/entities/game'

describe('option icons', () => {
  it('covers every option in the registry', () => {
    const missing = GAME_OPTIONS.filter((option) => OPTION_ICONS[option.key] === undefined).map(
      (option) => option.key
    )
    expect(missing).toEqual([])
  })

  it('invents no icon for a key the registry does not have', () => {
    const keys = new Set<string>(GAME_OPTIONS.map((option) => option.key))
    expect(Object.keys(OPTION_ICONS).filter((key) => !keys.has(key))).toEqual([])
  })

  it('gives the three visual mods three different glyphs', () => {
    const visual = ['blind', 'fading', 'flashlight'] as const
    const icons = visual.map((key) => OPTION_ICONS[key])
    expect(new Set(icons).size).toBe(visual.length)
  })

  it('has a glyph for every mode any surface offers', () => {
    const mode = optionOf('mode')
    // Both contexts, because the room offers a subset and solo adds `quote` —
    // an icon missing from the wider set is missing from the bar.
    const offered = new Set([...valuesFor(mode, 'solo'), ...valuesFor(mode, 'roomSettings')])
    const missing = [...offered].filter((value) => modeIconOf(value) === undefined)
    expect(missing).toEqual([])
  })

  it('returns nothing for a mode nothing offers, rather than a placeholder', () => {
    // `free` and `custom` are in the ConfigModes enum but reach no surface.
    expect(modeIconOf('free')).toBeUndefined()
    expect(modeIconOf('custom')).toBeUndefined()
  })
})
