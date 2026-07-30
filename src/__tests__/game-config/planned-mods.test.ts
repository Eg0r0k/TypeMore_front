/**
 * The multiplier the settings bar advertises before a run exists.
 *
 * Worth a test rather than a reading because the honest answer is NOT a product
 * over the toggles that are on: a quote's text is verbatim, so the four
 * word-affecting mods are withheld by the core — and a bar promising ×1.39 for a
 * run that will score ×1.00 is worse than no number at all.
 */
import { describe, expect, it } from 'vitest'

import { plannedMultiplier, type GameSettings } from '@/entities/game'
import { MOD_MULTIPLIERS, MOD_MULTIPLIER_CAP } from '@typemore/core'

const NO_MODS = { blind: false, fading: false, flashlight: false }

const settings = (overrides: Partial<GameSettings> = {}): GameSettings => ({
  mode: 'words',
  time: 30,
  words: 50,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  nospace: false,
  difficulty: 'normal',
  minWpm: 0,
  ...overrides
})

describe('plannedMultiplier', () => {
  it('is exactly 1.0 with nothing on', () => {
    expect(plannedMultiplier(settings(), NO_MODS)).toBe(1)
  })

  it('multiplies the text mods, the graded ones and the declared ones together', () => {
    const multiplier = plannedMultiplier(
      settings({ punctuation: true, difficulty: 'master', minWpm: 80 }),
      { ...NO_MODS, flashlight: true }
    )

    expect(multiplier).toBeCloseTo(1.1 * 1.25 * 1.25 * 1.4, 10)
  })

  it('withholds the word-affecting mods in quote mode, before any quote is drawn', () => {
    const chosen = { punctuation: true, numbers: true, randomCase: true, reverse: true }

    // The same four toggles, the only difference being the mode.
    expect(plannedMultiplier(settings(chosen), NO_MODS)).toBeCloseTo(1.1 * 1.08 * 1.15 * 1.25, 10)
    expect(plannedMultiplier(settings({ ...chosen, mode: 'quote' }), NO_MODS)).toBe(1)
  })

  it('still pays for the rule mods in quote mode — they are not about the text', () => {
    const multiplier = plannedMultiplier(
      settings({ mode: 'quote', punctuation: true, nospace: true, difficulty: 'expert' }),
      { ...NO_MODS, blind: true }
    )

    expect(multiplier).toBeCloseTo(1.12 * 1.15 * 1.3, 10)
  })

  it('caps the product, so a stacked setup cannot advertise more than the run scores', () => {
    const everything = plannedMultiplier(
      settings({
        punctuation: true,
        numbers: true,
        randomCase: true,
        reverse: true,
        nospace: true,
        difficulty: 'master',
        minWpm: 100
      }),
      { blind: true, fading: true, flashlight: true }
    )

    const raw = Object.values(MOD_MULTIPLIERS).reduce((acc, factor) => acc * factor, 1)
    expect(raw).toBeGreaterThan(MOD_MULTIPLIER_CAP)
    expect(everything).toBe(MOD_MULTIPLIER_CAP)
  })
})
