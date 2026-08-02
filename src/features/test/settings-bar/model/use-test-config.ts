import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'

import { useConfigStore } from '@/entities/config'
import { useRaceStore } from '@entities/race'
import {
  disabledReason,
  isVisible,
  optionOf,
  optionsFor,
  presetsFor,
  valuesFor,
  visibleOptionsFor,
  type ConstraintContext,
  type GameOption
} from '@/entities/game'
import { languageHasQuotesQueryOptions } from '@shared/api'
import { ConfigModes, type Config } from '@/shared/constants/type'
import { narrowTo } from '@/shared/lib/helpers/narrow'
import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'

/** One mode and the amount control that mode makes visible. */
export interface AmountVariant {
  readonly mode: string
  readonly option: GameOption
}

/**
 * Everything the solo test config READS and WRITES, with no layout attached.
 *
 * Two surfaces render the same settings — the bar above the field and, below
 * `md`, the modal that replaces it — and they must not each re-derive which
 * options exist, which values they take, or when they are locked. The layout
 * differs; the rules are shared, and they come from the game-config registry
 * filtered to the `solo` context.
 *
 * Note what is NOT here: the quote-availability watcher that falls back to
 * words. It is a side effect that must run exactly once, so it stays in the bar
 * (which is always mounted) rather than firing again per modal.
 */
export function useTestConfig() {
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config
  const race = useRaceStore()
  const { languageName } = useLanguageNames()

  const modeOption = optionOf('mode')
  const modeValues = computed(() => valuesFor(modeOption, 'solo'))

  /**
   * Constraint input: the run's intent. No quote is drawn yet at this point.
   * While the solo screen races a record the whole bar locks through the
   * registry's own mechanics (`racing` short-circuits every disabledWhen):
   * the setup on screen is the record's, and changing it IS exiting the race.
   */
  const ctx = computed<ConstraintContext>(() => ({
    mode: config.mode,
    ...(race.racing ? { racing: true as const } : {})
  }))

  /** The one lock reason every non-registry control shares while racing. */
  const raceLock = computed<string | null>(() => (race.racing ? t('game.constraint.racing') : null))

  const soloOptions = computed(() => visibleOptionsFor('solo', ctx.value))

  /** The keys the bar draws itself; everything else in `solo` is a notice chip. */
  const AMOUNT_KEYS: readonly string[] = ['time', 'words', 'quoteGroup']
  const BAR_KEYS: readonly string[] = ['mode', 'language', ...AMOUNT_KEYS]

  const isTextMod = (option: GameOption): boolean =>
    option.slot === 'generation' && option.control.kind === 'boolean'

  const textMods = computed(() => soloOptions.value.filter(isTextMod))
  const activeTextMods = computed(() =>
    textMods.value.filter((option) => config[option.key] === true).map((option) => option.key)
  )

  /**
   * The text mods a surface RENDERS. A mod gated by the mode itself (quote's
   * fixed text — toggling it would change nothing) leaves the bar entirely
   * instead of sitting greyed out; the constraint context here deliberately
   * omits `racing`, because a race lock is temporary and the record's setup
   * must stay readable — those render disabled in place. Writes still run over
   * the full `textMods` list, so a hidden mod keeps its stored value the same
   * way a disabled one always has.
   */
  const visibleTextMods = computed(() =>
    textMods.value.filter((option) => disabledReason(option, { mode: config.mode }) === null)
  )

  /**
   * Every mode's amount control, in mode order — NOT just the current one.
   *
   * The bar stacks all three in one box and crossfades between them, so it
   * needs the whole set at once: asking the registry per mode is what keeps
   * that from becoming a hand-written mode → key table beside the one in
   * `registry.ts`.
   */
  const amountVariants = computed<readonly AmountVariant[]>(() =>
    modeValues.value.flatMap((mode) => {
      const option = optionsFor('solo').find(
        (candidate) =>
          AMOUNT_KEYS.includes(candidate.key) &&
          isVisible(candidate, { mode: mode as Config['mode'] })
      )
      return option ? [{ mode, option }] : []
    })
  )

  const noticeOptions = computed(() =>
    soloOptions.value.filter((option) => !BAR_KEYS.includes(option.key) && !isTextMod(option))
  )
  // `minWpm` is presented inside the pace picker (speed things live together);
  // the registry option itself is untouched — this is only where it renders.
  const gradedSettings = computed(() =>
    noticeOptions.value.filter(
      (option) => option.control.kind !== 'boolean' && option.key !== 'minWpm'
    )
  )
  const flagSettings = computed(() =>
    noticeOptions.value.filter((option) => option.control.kind === 'boolean')
  )

  /** i18n key of why a text mod cannot be toggled right now, or `null`. */
  const reasonOf = (option: GameOption): string | null => disabledReason(option, ctx.value)

  const titleOf = (option: GameOption): string => {
    const reason = reasonOf(option)
    return reason === null ? t(option.i18nKey) : `${t(option.i18nKey)} — ${t(reason)}`
  }

  /** Values as strings, whichever control the option uses. */
  const valuesOf = (option: GameOption): readonly string[] =>
    option.control.kind === 'presets' ? presetsFor(option).map(String) : valuesFor(option, 'solo')

  /** A value's label: an enum's from its i18n prefix, a preset's from the number. */
  const labelOf = (option: GameOption, value: string): string => {
    if (option.valueI18nPrefix !== undefined) return t(`${option.valueI18nPrefix}.${value}`)
    if (option.key === 'minWpm' && value === '0') return t('game.minSpeedOff')
    return value
  }

  /** Whether the option is away from its default — the notice line highlights those. */
  const isCustom = (option: GameOption): boolean => config[option.key] !== option.defaultValue

  /**
   * A gated mod keeps its stored value: a disabled item cannot appear in the
   * incoming selection, and writing that absence back would clear a setting the
   * player never touched — so leaving a quote restores the mods it greyed out.
   */
  const onTextMods = (value: unknown): void => {
    const next = new Set(Array.isArray(value) ? (value as string[]) : [])
    for (const option of textMods.value) {
      if (reasonOf(option) !== null) continue
      // Through the action, not a raw field write: the store's validator is
      // the single gate every config write goes through.
      configStore.setConfig(option.key, next.has(option.key))
    }
  }

  const onTextMod = (option: GameOption): void => {
    if (reasonOf(option) !== null) return
    configStore.setConfig(option.key, config[option.key] !== true)
  }

  const onFlag = (option: GameOption): void => {
    configStore.setConfig(option.key, config[option.key] !== true)
  }

  const onMode = (value: unknown): void => {
    const mode = narrowTo(Object.values(ConfigModes), value)
    if (mode !== null) configStore.setMode(mode)
  }

  const onDimension = (option: GameOption, value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    if (option.key === 'time') configStore.setTime(Number(value))
    else if (option.key === 'words') configStore.setWords(Number(value))
    else configStore.setConfig(option.key as keyof Config, value as never)
  }

  /**
   * `setConfig` is generic in the key and a union of keys cannot satisfy that
   * generic, hence the cast; the validator table still checks the value at
   * runtime, exactly as it does for every other write.
   */
  const onGraded = (option: GameOption, value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    const parsed = option.control.kind === 'presets' ? Number(value) : String(value)
    configStore.setConfig(option.key as keyof Config, parsed as never)
  }

  const onLanguage = (value: string): void => {
    void configStore.setLanguage(value)
  }

  /**
   * Whether the chosen language has quotes at all. `undefined` while unknown
   * (loading, or the request failed) and the unknown case never acts: a network
   * blip must not rewrite the player's mode.
   */
  const { data: quotesAvailable } = useQuery(
    computed(() => languageHasQuotesQueryOptions(config.language))
  )

  const modeReason = (value: string): string | null =>
    raceLock.value !== null
      ? raceLock.value
      : value === ConfigModes.Quote && quotesAvailable.value === false
        ? t('game.quote.none', { lang: languageName(config.language) })
        : null

  return {
    t,
    config,
    configStore,
    race,
    languageName,
    modeOption,
    modeValues,
    modeReason,
    raceLock,
    textMods,
    visibleTextMods,
    activeTextMods,
    amountVariants,
    gradedSettings,
    flagSettings,
    quotesAvailable,
    reasonOf,
    titleOf,
    valuesOf,
    labelOf,
    isCustom,
    onTextMods,
    onTextMod,
    onFlag,
    onMode,
    onDimension,
    onGraded,
    onLanguage
  }
}
