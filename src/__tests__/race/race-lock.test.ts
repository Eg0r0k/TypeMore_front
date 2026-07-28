import { describe, expect, it } from 'vitest'

import { GAME_OPTIONS, disabledReason } from '@entities/game'

/**
 * The settings-bar lock while racing (C10): the registry's own context
 * mechanics carry it — `racing` in the constraint context outranks every
 * per-option rule, so EVERY option is disabled with the one reason, and no
 * new option can forget to participate.
 */
describe('registry — the race lock', () => {
  it('disables every option with the race reason while racing', () => {
    for (const option of GAME_OPTIONS) {
      expect(disabledReason(option, { mode: 'words', racing: true })).toBe('game.constraint.racing')
    }
  })

  it('changes nothing when not racing', () => {
    for (const option of GAME_OPTIONS) {
      expect(disabledReason(option, { mode: 'words' })).toBe(
        disabledReason(option, { mode: 'words', racing: undefined })
      )
    }
  })
})
