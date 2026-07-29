import { describe, expect, it } from 'vitest'

import {
  GAME_OPTIONS,
  OPTION_CONTEXTS,
  disabledReason,
  emitsFixedText,
  isVisible,
  optionOf,
  optionsFor,
  presetsFor,
  valuesFor,
  visibleOptionsFor,
  type ConstraintContext,
  type GameOption,
  type OptionContext
} from '@/entities/game'
import DEFAULT_CONFIG from '@/shared/constants/default-config'
import { ConfigModes } from '@/shared/constants/type'

/**
 * The registry is the single description of which game options exist. Its value
 * is entirely in NOT drifting from three other things: the `Config` type, the
 * shipped defaults, and the wire shapes in the backend's PROTOCOL.md §5. Each
 * describe below pins one of those.
 *
 * The compile-time half of exhaustiveness lives in the registry itself
 * (`_ConfigIsPartitioned` / `_RegistryIsExhaustive`) and is enforced by vue-tsc.
 * These specs are the runtime mirror: they fail on the same mistakes, but with a
 * readable diff naming the forgotten key.
 */

/** `Config` fields that are deliberately NOT game options. */
const APP_ONLY_KEYS = [
  'backgroundImg',
  'backgroundLocal',
  'backgroundSize',
  'caretStyle',
  'devTools',
  'fontFamily',
  'fontSize',
  'paceCaret',
  'paceCaretWpm',
  'playSound',
  'showFps',
  'showKeyboard',
  'smoothCaret',
  'soundSet',
  'soundVolume',
  'theme',
  'uiLanguage'
] as const

const soloCtx = (mode: ConfigModes): ConstraintContext => ({ mode })
const keysOf = (options: readonly GameOption[]): readonly string[] => options.map((o) => o.key)

describe('exhaustiveness — every Config field is classified', () => {
  it('partitions Config into registry options and app-only fields, with nothing left over', () => {
    const configKeys = Object.keys(DEFAULT_CONFIG).sort()
    const classified = [...keysOf(GAME_OPTIONS), ...APP_ONLY_KEYS].sort()

    // A new `Config` field lands in neither list and shows up here by name.
    expect(classified).toEqual(configKeys)
  })

  it('declares no key twice', () => {
    const keys = keysOf(GAME_OPTIONS)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('carries the SHIPPED default for every option, not a second copy of it', () => {
    // Two default tables that disagree is exactly the divergence this file exists
    // to stop: the bar would render one value and a fresh profile would save another.
    for (const option of GAME_OPTIONS) {
      expect({ [option.key]: option.defaultValue }).toEqual({
        [option.key]: DEFAULT_CONFIG[option.key]
      })
    }
  })

  it('resolves every key through optionOf and rejects an unknown one', () => {
    for (const option of GAME_OPTIONS) expect(optionOf(option.key)).toBe(option)
    // @ts-expect-error — the runtime guard exists for JS callers and typos.
    expect(() => optionOf('notAnOption')).toThrow(/unknown game option/)
  })

  it('gives every option a non-empty i18n key', () => {
    for (const option of GAME_OPTIONS) expect(option.i18nKey.length).toBeGreaterThan(0)
  })
})

describe('optionsFor(context) — an option renders only where it is declared', () => {
  it('places every option in at least one context', () => {
    const orphans = GAME_OPTIONS.filter(
      (o) => !OPTION_CONTEXTS.some((context) => o.contexts[context])
    )
    expect(keysOf(orphans)).toEqual([])
  })

  it('lists the solo bar — everything the player sets above the field', () => {
    expect(keysOf(optionsFor('solo'))).toEqual([
      'mode',
      'time',
      'words',
      'quoteGroup',
      'language',
      'punctuation',
      'numbers',
      'randomCase',
      'reverse',
      'difficulty',
      'minWpm',
      'nospace',
      'blind',
      'fading',
      'flashlight'
    ])
  })

  it('lists the settings modal — the input-behaviour trio the bar has no room for', () => {
    expect(keysOf(optionsFor('settingsModal'))).toEqual(['freedomMode', 'stopOnError', 'quickEnd'])
  })

  it('gives each option exactly one editing home per audience', () => {
    // The bar and the modal are both "solo": an option in both would be two
    // controls writing one config field, which is the duplication this replaces.
    for (const option of GAME_OPTIONS) {
      expect(option.contexts.solo && option.contexts.settingsModal).toBe(false)
    }
  })

  it('lists room settings — the shared, text-affecting fields and nothing else', () => {
    expect(keysOf(optionsFor('roomSettings'))).toEqual([
      'mode',
      'time',
      'words',
      'quoteGroup',
      'language',
      'punctuation',
      'numbers',
      'randomCase',
      'reverse'
    ])
  })

  it('lists freemods — the three per-seat, log-provable options', () => {
    expect(keysOf(optionsFor('freemod'))).toEqual(['difficulty', 'minWpm', 'nospace'])
  })

  it('never renders a solo-only option in a shared context', () => {
    const soloOnly = GAME_OPTIONS.filter(
      (o) =>
        (o.contexts.solo || o.contexts.settingsModal) &&
        !o.contexts.roomSettings &&
        !o.contexts.freemod
    )
    // The input-behaviour trio and the visual mods.
    expect(keysOf(soloOnly)).toEqual([
      'freedomMode',
      'stopOnError',
      'quickEnd',
      'blind',
      'fading',
      'flashlight'
    ])

    const shared = [...keysOf(optionsFor('roomSettings')), ...keysOf(optionsFor('freemod'))]
    for (const key of keysOf(soloOnly)) expect(shared).not.toContain(key)
  })

  it('keeps view-only mods off both wire contexts (PROTOCOL.md §5: never on the wire)', () => {
    const view = GAME_OPTIONS.filter((o) => o.slot === 'view')
    expect(keysOf(view)).toEqual(['blind', 'fading', 'flashlight'])
    for (const option of view) {
      expect(option.contexts.roomSettings).toBe(false)
      expect(option.contexts.freemod).toBe(false)
    }
  })
})

describe('PROTOCOL.md §5 — the registry maps to the wire, it does not reshape it', () => {
  /** Registry key → the `RoomSettings` field it feeds. */
  const ROOM_WIRE_FIELD: Record<string, string> = {
    mode: 'mode',
    time: 'durationMs',
    words: 'wordCount',
    // The band filters the host's draw; what travels is the drawn quote's id
    // (`textSource.quoteId`) and its length (`wordCount`).
    quoteGroup: 'textSource',
    language: 'lang',
    punctuation: 'textMods',
    numbers: 'textMods',
    randomCase: 'textMods',
    reverse: 'textMods'
  }
  /** Registry key → the `Freemods` field it feeds. */
  const FREEMOD_WIRE_FIELD: Record<string, string> = {
    difficulty: 'difficulty',
    minWpm: 'minWpm',
    nospace: 'nospace'
  }

  it('maps every roomSettings option onto a documented settings field', () => {
    for (const option of optionsFor('roomSettings')) {
      expect(ROOM_WIRE_FIELD[option.key]).toBeDefined()
    }
    expect(Object.keys(ROOM_WIRE_FIELD).sort()).toEqual(
      [...keysOf(optionsFor('roomSettings'))].sort()
    )
  })

  it('maps every freemod option onto a documented freemods field', () => {
    expect(Object.keys(FREEMOD_WIRE_FIELD).sort()).toEqual(
      [...keysOf(optionsFor('freemod'))].sort()
    )
  })

  it('offers a room every mode — a room may race a quote, not only a seeded text', () => {
    const mode = optionOf('mode')
    expect(valuesFor(mode, 'roomSettings')).toEqual(['words', 'time', 'quote'])
    expect(valuesFor(mode, 'solo')).toEqual(['words', 'time', 'quote'])
  })

  it('holds durations in SECONDS — the ms conversion belongs to the room adapter', () => {
    // The same four values the room form sends as 15000/30000/60000/120000.
    expect(presetsFor(optionOf('time'))).toEqual([15, 30, 60, 120])
    expect(presetsFor(optionOf('words'))).toEqual([10, 25, 50, 100])
    expect(presetsFor(optionOf('minWpm'))).toEqual([0, 60, 80, 100])
  })

  it('returns no presets for a non-preset control and no values for a non-enum', () => {
    expect(presetsFor(optionOf('punctuation'))).toEqual([])
    expect(valuesFor(optionOf('punctuation'), 'solo')).toEqual([])
  })
})

describe('constraints — quote disables the word-affecting mods', () => {
  const WORD_AFFECTING = ['punctuation', 'numbers', 'randomCase', 'reverse'] as const

  it('reports fixed text for a quote and not for a seeded mode', () => {
    expect(emitsFixedText(soloCtx(ConfigModes.Quote))).toBe(true)
    expect(emitsFixedText(soloCtx(ConfigModes.Words))).toBe(false)
    expect(emitsFixedText(soloCtx(ConfigModes.Time))).toBe(false)
  })

  it('disables exactly the four word-affecting mods, with a reason', () => {
    const quote = soloCtx(ConfigModes.Quote)
    const disabled = GAME_OPTIONS.filter((o) => disabledReason(o, quote) !== null)
    expect(keysOf(disabled)).toEqual([...WORD_AFFECTING])
    for (const option of disabled) {
      expect(disabledReason(option, quote)).toBe('game.constraint.fixedText')
    }
  })

  it('disables nothing in a seeded mode', () => {
    for (const mode of [ConfigModes.Words, ConfigModes.Time]) {
      const enabled = GAME_OPTIONS.filter((o) => disabledReason(o, soloCtx(mode)) !== null)
      expect(keysOf(enabled)).toEqual([])
    }
  })

  it('honours a resolved textSource over the mode, so a drawn quote agrees with the intent', () => {
    // The settings bar constrains on intent (mode) before a quote is drawn; the
    // run constrains on the resolved source. Both must answer the same.
    const drawn: ConstraintContext = {
      mode: ConfigModes.Quote,
      textSource: { kind: 'quote', quoteId: 'q1', quoteHash: 'abc', text: 'a b c' }
    }
    expect(emitsFixedText(drawn)).toBe(true)
    expect(disabledReason(optionOf('punctuation'), drawn)).toBe('game.constraint.fixedText')

    const seeded: ConstraintContext = { mode: ConfigModes.Words, textSource: { kind: 'seeded' } }
    expect(emitsFixedText(seeded)).toBe(false)
    expect(disabledReason(optionOf('punctuation'), seeded)).toBeNull()
  })

  it('leaves difficulty, minWpm and nospace available on a quote — they are input rules, not text', () => {
    const quote = soloCtx(ConfigModes.Quote)
    for (const key of ['difficulty', 'minWpm', 'nospace'] as const) {
      expect(disabledReason(optionOf(key), quote)).toBeNull()
    }
  })
})

describe('constraints — the dimension preset follows the mode', () => {
  const dimensionKeys = (mode: ConfigModes): readonly string[] =>
    keysOf(visibleOptionsFor('solo', soloCtx(mode))).filter((key) =>
      ['time', 'words', 'quoteGroup'].includes(key)
    )

  it('shows seconds in time mode, word count in words mode, the band in quote mode', () => {
    expect(dimensionKeys(ConfigModes.Time)).toEqual(['time'])
    expect(dimensionKeys(ConfigModes.Words)).toEqual(['words'])
    expect(dimensionKeys(ConfigModes.Quote)).toEqual(['quoteGroup'])
  })

  it('shows exactly one dimension control in every mode', () => {
    for (const mode of [ConfigModes.Time, ConfigModes.Words, ConfigModes.Quote]) {
      expect(dimensionKeys(mode)).toHaveLength(1)
    }
  })

  it('hides quickEnd in time mode — it only applies to a run that ends on a last word', () => {
    expect(isVisible(optionOf('quickEnd'), soloCtx(ConfigModes.Time))).toBe(false)
    expect(isVisible(optionOf('quickEnd'), soloCtx(ConfigModes.Words))).toBe(true)
    expect(isVisible(optionOf('quickEnd'), soloCtx(ConfigModes.Quote))).toBe(true)
  })

  it('treats an option with no rule as always visible', () => {
    for (const mode of [ConfigModes.Time, ConfigModes.Words, ConfigModes.Quote]) {
      expect(isVisible(optionOf('language'), soloCtx(mode))).toBe(true)
      expect(isVisible(optionOf('blind'), soloCtx(mode))).toBe(true)
    }
  })

  it('names its dependency wherever a rule reads another option', () => {
    const conditional = GAME_OPTIONS.filter((o) => o.visibleWhen ?? o.disabledWhen)
    for (const option of conditional) {
      expect(option.dependsOn ?? []).toContain('mode')
    }
  })
})

describe('optionsFor is stable and pure', () => {
  it('returns declaration order, not registry-internal order', () => {
    const declared = keysOf(GAME_OPTIONS)
    for (const context of OPTION_CONTEXTS satisfies readonly OptionContext[]) {
      const listed = keysOf(optionsFor(context))
      const expected = declared.filter((key) => listed.includes(key))
      expect(listed).toEqual(expected)
    }
  })

  it('does not mutate the registry when filtering', () => {
    const before = keysOf(GAME_OPTIONS)
    visibleOptionsFor('solo', soloCtx(ConfigModes.Quote))
    optionsFor('freemod')
    expect(keysOf(GAME_OPTIONS)).toEqual(before)
  })
})
