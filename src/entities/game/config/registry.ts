/**
 * The one declarative description of the game's OPTIONS: which exist, what they
 * are called, where they may be edited, and when they are unavailable.
 *
 * Why this file exists. Four surfaces used to each carry their own copy of that
 * knowledge — the solo settings bar, the room settings form, the seat's freemod
 * picker and the app settings modal. They agreed by hand, and they had already
 * drifted: the same four word-affecting mods were spelled `QUOTE_GATED` in one
 * file and `TEXT_MOD_KEYS` in another, the same four durations were seconds in
 * one and milliseconds in the other, and `difficulty` / `minWpm` / `nospace`
 * appeared in the room panel although the wire sends them per-seat.
 *
 * WHAT THIS IS NOT. It is a UI/meta layer. It does not compute, generate or
 * validate anything: `shared/core` is untouched by it, `toCoreSetup` remains the
 * only config → core mapping, and the room/freemod WIRE shapes (PROTOCOL.md §5)
 * are defined by the protocol, never by this table. The registry says an option
 * MAY be edited in a context; the adapter at that context still owns the
 * translation into whatever shape the destination requires — including the
 * seconds → milliseconds conversion the room form needs.
 *
 * EXHAUSTIVENESS is the anti-divergence mechanism. Every field of `Config` is
 * either a game option described here or an explicitly-listed app-only field;
 * the two compile-time assertions at the bottom of this file fail `vue-tsc` when
 * a new field is added to `Config` and to neither list. That is the whole point:
 * the next option cannot be added to the type and quietly forgotten by a
 * surface.
 */
import { emitsRawTokens, type GenerationConfig, type GenerationTextSource } from '@shared/core'
import type { Config } from '@/shared/constants/type'
import DEFAULT_CONFIG from '@/shared/constants/default-config'

/**
 * Which reconstruction an option belongs to — the slot invariant from
 * `docs/game-architecture.md`. Mirrored here as DATA so a surface can group or
 * mark options by it (visual mods are "not scored in matches" precisely because
 * they are `view`); the invariant itself is enforced by the core's types.
 */
export type OptionSlot = 'generation' | 'core' | 'view'

/**
 * Where an option may be edited — one per SURFACE, because a surface is what
 * can forget an option. `solo` is the settings bar above the field;
 * `settingsModal` is the app settings dialog, which owns the input-behaviour
 * options the bar has no room for.
 *
 * `roomSettings`, `freemod` and `roomLocal` are three DIFFERENT things inside a
 * room, and the distinction is the wire:
 *  - `roomSettings` — host-owned, `settings_update`, identical for every seat;
 *  - `freemod` — per-seat and ON THE WIRE (`set_freemods`), so it is frozen at
 *    countdown and multiplies that seat's score;
 *  - `roomLocal` — per-seat and NOT on the wire. The view-only mods live here:
 *    they leave no trace in the event log, so they cannot be scored and are not
 *    freemods — which is a reason to keep them off the protocol, not a reason
 *    to withhold them from the player who wants to type blindfolded. They apply
 *    from the player's own config, exactly as in solo.
 */
export type OptionContext = 'solo' | 'settingsModal' | 'roomSettings' | 'freemod' | 'roomLocal'

export const OPTION_CONTEXTS = [
  'solo',
  'settingsModal',
  'roomSettings',
  'freemod',
  'roomLocal'
] as const

export type OptionControl =
  | { readonly kind: 'boolean' }
  | {
      readonly kind: 'enum'
      readonly values: readonly string[]
      /**
       * Contexts that accept only a subset. `mode` is the live case: solo offers
       * `quote`, a room does not — v0 of the protocol validates
       * `textSource.kind == "seeded"`, so offering it would be an option the
       * server rejects.
       */
      readonly valuesByContext?: Partial<Record<OptionContext, readonly string[]>>
    }
  | { readonly kind: 'presets'; readonly values: readonly number[] }

export interface OptionContexts {
  readonly solo: boolean
  readonly settingsModal: boolean
  readonly roomSettings: boolean
  readonly freemod: boolean
  readonly roomLocal: boolean
}

/**
 * The state a constraint reads. Deliberately tiny: a constraint is a pure
 * function of the run's INTENT, not of the whole config, so it can be evaluated
 * by a settings bar that has not drawn a quote yet.
 */
export interface ConstraintContext {
  readonly mode: Config['mode']
  /** The resolved source once a run exists. Absent while the player is still choosing. */
  readonly textSource?: GenerationTextSource
}

/** An i18n key explaining why an option is unavailable, or `null` when it is available. */
export type DisabledReason = string | null

export interface OptionDescriptor<K extends GameOptionKey = GameOptionKey> {
  readonly key: K
  readonly slot: OptionSlot
  readonly control: OptionControl
  readonly contexts: OptionContexts
  /** i18n key for the option's own label. */
  readonly i18nKey: string
  /**
   * Literal `aria-label` for the option's control group. Not translated: it is
   * the accessibility handle the Playwright specs address, so it lives here
   * rather than being retyped per surface.
   */
  readonly ariaLabel?: string
  /** i18n key prefix for an enum's value labels (`${prefix}.${value}`). */
  readonly valueI18nPrefix?: string
  readonly defaultValue: Config[K]
  /** Options whose value this one reacts to — documentation and test fodder. */
  readonly dependsOn?: readonly GameOptionKey[]
  /** Hidden entirely (a dimension preset that does not apply to the current mode). */
  readonly visibleWhen?: (ctx: ConstraintContext) => boolean
  /** Rendered but not editable, with a reason the surface must show. */
  readonly disabledWhen?: (ctx: ConstraintContext) => DisabledReason
}

/**
 * A stand-in quote used only to ask the CORE whether the planned run emits raw
 * tokens. The alternative — testing `mode === 'quote'` here — would be a second
 * definition of "this text is fixed" living in the UI, free to drift from
 * `emitsRawTokens` the moment the core grows another verbatim source (a code
 * dictionary sets `rawTokens` without being a quote at all). Routing the intent
 * through the real predicate keeps exactly one.
 *
 * Exported for `plannedMods`, which needs the same stand-in for the same reason:
 * it asks the core what the planned run would score before a quote is drawn.
 */
export const QUOTE_PROBE: GenerationTextSource = {
  kind: 'quote',
  quoteId: '',
  quoteHash: '',
  text: ''
}

/**
 * True when the run's targets are emitted verbatim (quote text, code tokens).
 * The generation is synthesised only far enough for the core's predicate to
 * answer; nothing else reads it.
 */
export const emitsFixedText = (ctx: ConstraintContext): boolean =>
  emitsRawTokens({
    mode: ctx.mode as GenerationConfig['mode'],
    length: 0,
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false,
    textSource: ctx.textSource ?? (ctx.mode === 'quote' ? QUOTE_PROBE : undefined)
  })

/**
 * The four WORD-AFFECTING mods. Disabled — never silently ignored, and never
 * cleared — whenever the targets are verbatim: the core's `generateWords` skips
 * the transforms and `activeModsV1` withholds their multipliers, so leaving them
 * enabled would advertise an effect the run does not get.
 */
const wordAffecting = (ctx: ConstraintContext): DisabledReason =>
  emitsFixedText(ctx) ? 'game.constraint.fixedText' : null

const inMode =
  (...modes: readonly string[]) =>
  (ctx: ConstraintContext): boolean =>
    modes.includes(ctx.mode)

/** Identity helper: preserves the literal `key` so `defaultValue` is checked against it. */
const option = <K extends GameOptionKey>(descriptor: OptionDescriptor<K>): OptionDescriptor<K> =>
  descriptor

const D = DEFAULT_CONFIG

export const GAME_OPTIONS = [
  // ── Shape of the run ──────────────────────────────────────────────────────
  option({
    key: 'mode',
    slot: 'generation',
    control: {
      kind: 'enum',
      values: ['words', 'time', 'quote']
    },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'room.mode',
    ariaLabel: 'mode',
    valueI18nPrefix: 'game.mode',
    defaultValue: D.mode
  }),
  option({
    key: 'time',
    slot: 'core',
    // SECONDS. The room form sends `durationMs` and multiplies at its own
    // adapter — the wire shape is the protocol's, not this table's.
    control: { kind: 'presets', values: [15, 30, 60, 120] },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'room.duration',
    ariaLabel: 'amount',
    defaultValue: D.time,
    dependsOn: ['mode'],
    visibleWhen: inMode('time')
  }),
  option({
    key: 'words',
    slot: 'generation',
    control: { kind: 'presets', values: [10, 25, 50, 100] },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'room.wordCount',
    ariaLabel: 'amount',
    defaultValue: D.words,
    dependsOn: ['mode'],
    visibleWhen: inMode('words')
  }),
  option({
    key: 'quoteGroup',
    slot: 'generation',
    control: {
      kind: 'enum',
      values: ['all', 'short', 'medium', 'long', 'thicc']
    },
    contexts: {
      solo: true,
      settingsModal: false,
      // A room draws its quote from the same length band, once, when the host
      // picks it — the band is a filter on the draw, not a wire field.
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.quote.length',
    ariaLabel: 'quote length',
    valueI18nPrefix: 'game.quote.group',
    defaultValue: D.quoteGroup,
    dependsOn: ['mode'],
    visibleWhen: inMode('quote')
  }),
  option({
    key: 'language',
    slot: 'generation',
    // Free-form: the catalogue is fetched, so the registry names the control
    // rather than enumerating values it cannot know at build time.
    control: { kind: 'enum', values: [] },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.language',
    defaultValue: D.language
  }),

  // ── Word-affecting mods (generation) ──────────────────────────────────────
  option({
    key: 'punctuation',
    slot: 'generation',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.punctuation',
    defaultValue: D.punctuation,
    dependsOn: ['mode'],
    disabledWhen: wordAffecting
  }),
  option({
    key: 'numbers',
    slot: 'generation',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.numbers',
    defaultValue: D.numbers,
    dependsOn: ['mode'],
    disabledWhen: wordAffecting
  }),
  option({
    key: 'randomCase',
    slot: 'generation',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.randomCase',
    defaultValue: D.randomCase,
    dependsOn: ['mode'],
    disabledWhen: wordAffecting
  }),
  option({
    key: 'reverse',
    slot: 'generation',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: true,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'game.reverse',
    defaultValue: D.reverse,
    dependsOn: ['mode'],
    disabledWhen: wordAffecting
  }),

  // ── Freemods (core; per-seat on the wire, never room-wide) ────────────────
  option({
    key: 'difficulty',
    slot: 'core',
    control: {
      kind: 'enum',
      values: ['normal', 'expert', 'master']
    },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: true,
      roomLocal: false
    },
    i18nKey: 'game.difficulty.label',
    ariaLabel: 'difficulty',
    valueI18nPrefix: 'game.difficulty',
    defaultValue: D.difficulty
  }),
  option({
    key: 'minWpm',
    slot: 'core',
    control: { kind: 'presets', values: [0, 60, 80, 100] },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: true,
      roomLocal: false
    },
    i18nKey: 'game.minSpeed',
    ariaLabel: 'min speed',
    defaultValue: D.minWpm
  }),
  option({
    key: 'nospace',
    slot: 'core',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: true,
      roomLocal: false
    },
    i18nKey: 'game.nospace',
    defaultValue: D.nospace
  }),

  // ── Input behaviour (core; edited in the app settings modal, not the bar) ─
  option({
    key: 'freedomMode',
    slot: 'core',
    control: { kind: 'boolean' },
    contexts: {
      solo: false,
      settingsModal: true,
      roomSettings: false,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'settings.freedomMode.label',
    defaultValue: D.freedomMode
  }),
  option({
    key: 'stopOnError',
    slot: 'core',
    control: {
      kind: 'enum',
      values: ['off', 'letter', 'word']
    },
    contexts: {
      solo: false,
      settingsModal: true,
      roomSettings: false,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'settings.stopOnError.label',
    valueI18nPrefix: 'settings.stopOnError',
    defaultValue: D.stopOnError
  }),
  option({
    key: 'quickEnd',
    slot: 'core',
    control: { kind: 'boolean' },
    contexts: {
      solo: false,
      settingsModal: true,
      roomSettings: false,
      freemod: false,
      roomLocal: false
    },
    i18nKey: 'settings.quickEnd.label',
    defaultValue: D.quickEnd,
    dependsOn: ['mode'],
    visibleWhen: inMode('words', 'quote')
  }),

  // ── Visual mods (view-only; never on the wire, never scored in a match) ───
  option({
    key: 'blind',
    slot: 'view',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: false,
      roomLocal: true
    },
    i18nKey: 'game.blind',
    defaultValue: D.blind
  }),
  option({
    key: 'fading',
    slot: 'view',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: false,
      roomLocal: true
    },
    i18nKey: 'game.fading',
    defaultValue: D.fading
  }),
  option({
    key: 'flashlight',
    slot: 'view',
    control: { kind: 'boolean' },
    contexts: {
      solo: true,
      settingsModal: false,
      roomSettings: false,
      freemod: false,
      roomLocal: true
    },
    i18nKey: 'game.flashlight',
    defaultValue: D.flashlight
  })
] as const

export type GameOption = (typeof GAME_OPTIONS)[number]

// ── Helpers (pure, no Vue) ───────────────────────────────────────────────────

const BY_KEY: Record<string, GameOption | undefined> = Object.fromEntries(
  GAME_OPTIONS.map((o) => [o.key, o])
)

/** Descriptor lookup. Throws on an unknown key — a typo here is a bug, not a blank row. */
export function optionOf(key: GameOptionKey): GameOption {
  const found = BY_KEY[key]
  if (!found) throw new Error(`unknown game option: ${key}`)
  return found
}

/** Every option editable in a context, in declaration order. */
export function optionsFor(context: OptionContext): readonly GameOption[] {
  return GAME_OPTIONS.filter((o) => o.contexts[context])
}

/** The values a context accepts, narrowed by `valuesByContext`. */
export function valuesFor(option: GameOption, context: OptionContext): readonly string[] {
  if (option.control.kind !== 'enum') return []
  return option.control.valuesByContext?.[context] ?? option.control.values
}

/** Numeric presets, or `[]` for a non-preset control. */
export function presetsFor(option: GameOption): readonly number[] {
  return option.control.kind === 'presets' ? option.control.values : []
}

/** Whether the option is rendered at all in the current state. */
export function isVisible(option: GameOption, ctx: ConstraintContext): boolean {
  return option.visibleWhen?.(ctx) ?? true
}

/** The i18n key explaining why the option cannot be edited, or `null`. */
export function disabledReason(option: GameOption, ctx: ConstraintContext): DisabledReason {
  return option.disabledWhen?.(ctx) ?? null
}

/** Visible options for a context in the current state, in declaration order. */
export function visibleOptionsFor(
  context: OptionContext,
  ctx: ConstraintContext
): readonly GameOption[] {
  return optionsFor(context).filter((o) => isVisible(o, ctx))
}

// ── Compile-time exhaustiveness ──────────────────────────────────────────────

/**
 * The `Config` fields governed by this registry. Adding a field to `Config`
 * without listing it here OR in `AppOnlyConfigKey` breaks `_ConfigIsPartitioned`
 * below, which is how a new option is stopped from reaching the type while
 * remaining invisible to every surface.
 */
export type GameOptionKey =
  | 'mode'
  | 'time'
  | 'words'
  | 'quoteGroup'
  | 'language'
  | 'punctuation'
  | 'numbers'
  | 'randomCase'
  | 'reverse'
  | 'difficulty'
  | 'minWpm'
  | 'nospace'
  | 'freedomMode'
  | 'stopOnError'
  | 'quickEnd'
  | 'blind'
  | 'fading'
  | 'flashlight'

/**
 * `Config` fields that are NOT game options: appearance, sound, and the
 * interface locale. They are edited in the settings modal and never reach a run.
 */
export type AppOnlyConfigKey =
  | 'devTools'
  | 'uiLanguage'
  | 'theme'
  | 'backgroundImg'
  | 'backgroundLocal'
  | 'backgroundSize'
  | 'showFps'
  | 'playSound'
  | 'showKeyboard'
  | 'soundVolume'
  | 'soundSet'
  | 'fontSize'
  | 'fontFamily'
  | 'smoothCaret'
  | 'caretStyle'

type Assert<T extends true> = T
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** Every `Config` field is exactly one of: a game option, or an app-only field. */
export type _ConfigIsPartitioned = Assert<Equals<GameOptionKey | AppOnlyConfigKey, keyof Config>>

/** Every game option key has a descriptor, and no descriptor invents a key. */
export type _RegistryIsExhaustive = Assert<Equals<GameOption['key'], GameOptionKey>>
