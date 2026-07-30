// @vitest-environment node
//
// modMultiplierV1 (SCORING_CONCEPT.md §2): the multiplier table as data, the
// ×4.0 cap, and the verifiable (setup-derived) / declared (trusted) split.
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type GenerationConfig,
  type ModsDeclaration,
  DEFAULT_MAX_EXTRA_CHARS,
  MOD_MULTIPLIER_CAP,
  activeModsV1,
  modMultiplierV1
} from '@shared/core'

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 10,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const core = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const NO_MODS: ModsDeclaration = { blind: false, fading: false, flashlight: false }
const setup = (g: Partial<GenerationConfig> = {}, c: Partial<CoreConfig> = {}) => ({
  generation: gen(g),
  config: core(c)
})

describe('modMultiplierV1 — table (every mod alone)', () => {
  it('no active mods => exactly 1.0', () => {
    expect(modMultiplierV1(setup(), NO_MODS)).toBe(1)
    expect(activeModsV1(setup(), NO_MODS)).toEqual([])
  })

  it.each([
    ['punctuation', setup({ punctuation: true }), NO_MODS, 1.1],
    ['numbers', setup({ numbers: true }), NO_MODS, 1.08],
    ['randomCase', setup({ randomCase: true }), NO_MODS, 1.15],
    ['reverse', setup({ reverse: true }), NO_MODS, 1.25],
    ['nospace', setup({}, { nospace: true }), NO_MODS, 1.12],
    ['expert', setup({}, { difficulty: 'expert' }), NO_MODS, 1.15],
    ['master', setup({}, { difficulty: 'master' }), NO_MODS, 1.25],
    ['minSpeed60', setup({}, { minWpm: 60 }), NO_MODS, 1.1],
    ['minSpeed80', setup({}, { minWpm: 80 }), NO_MODS, 1.25],
    ['minSpeed100', setup({}, { minWpm: 100 }), NO_MODS, 1.45],
    ['blind', setup(), { blind: true, fading: false, flashlight: false }, 1.3],
    ['fading', setup(), { blind: false, fading: true, flashlight: false }, 1.35],
    ['flashlight', setup(), { blind: false, fading: false, flashlight: true }, 1.4]
  ] as const)('%s alone => ×%f', (_id, s, decl, expected) => {
    expect(modMultiplierV1(s, decl)).toBeCloseTo(expected, 10)
  })
})

describe('modMultiplierV1 — cap and composition', () => {
  it('the full stack caps at exactly ×4.0', () => {
    const s = setup(
      { punctuation: true, numbers: true, randomCase: true, reverse: true },
      { nospace: true, difficulty: 'master', minWpm: 100 }
    )
    const all: ModsDeclaration = { blind: true, fading: true, flashlight: true }
    expect(MOD_MULTIPLIER_CAP).toBe(4.0)
    expect(modMultiplierV1(s, all)).toBe(4.0)
  })

  it('two mods multiply (punctuation × blind)', () => {
    const m = modMultiplierV1(setup({ punctuation: true }), {
      blind: true,
      fading: false,
      flashlight: false
    })
    expect(m).toBeCloseTo(1.1 * 1.3, 10)
  })
})

describe('modMultiplierV1 — verifiable / declared split', () => {
  it('active mods list draws verifiable from the setup, declared from the declaration', () => {
    const mods = activeModsV1(setup({ punctuation: true }, { minWpm: 80 }), {
      blind: true,
      fading: false,
      flashlight: false
    })
    const ids = mods.map((m) => m.id)
    expect(ids).toEqual(['punctuation', 'minSpeed80', 'blind'])
  })

  it('a declared mod changes the multiplier only through the declaration', () => {
    const s = setup({ punctuation: true })
    const base = modMultiplierV1(s, NO_MODS)
    const withBlind = modMultiplierV1(s, { blind: true, fading: false, flashlight: false })
    expect(withBlind).toBeCloseTo(base * 1.3, 10)
  })
})
