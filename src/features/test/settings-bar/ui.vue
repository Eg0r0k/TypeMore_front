<template>
  <div class="settings-bar">
    <!--
      One line, three zones: the text mods on the left, the MODE in the middle,
      the mode's amount on the right.

      A three-column grid (`1fr auto 1fr`) rather than a centred flex row,
      because the mode group has to sit at the bar's true centre and stay there.
      The zones beside it change width constantly — quote hides all five text
      mods, and the amount group is 300px of quote bands against 170px of
      seconds — and in a flex row every one of those changes shifted the control
      a player touches most. Equal `1fr` sides make the middle column's centre
      the bar's centre whatever the sides contain, so nothing needs a reserved
      width and nothing moves. Deliberately no animation on the swap.

      The sides face inward (`end` / `start`), so the three zones stay one tight
      cluster over the typing field instead of being flung to the page edges.
    -->
    <div class="settings-bar__primary">
      <!--
        Text mods, as glyphs — the same OPTION_ICONS the results screen draws
        them with, so a mod looks identical where it is chosen and where it is
        reported. The name (with the reason, when one is disabled) is the
        tooltip AND the accessible name, so nothing is hover-only.

        Mods that cannot affect the current run (quote's fixed text) leave the
        bar entirely. A race lock still renders them disabled in place: the
        record's setup stays readable.
      -->
      <div class="settings-bar__zone settings-bar__zone--start h-full">
        <ToggleGroup
          v-if="visibleTextMods.length"
          class="max-sm:flex-wrap max-sm:justify-center"
          type="multiple"
          :model-value="activeTextMods"
          :aria-label="t('game.textMods')"
          @update:model-value="onTextMods"
        >
          <Tooltip v-for="option in visibleTextMods" :key="option.key">
            <TooltipTrigger as-child>
              <ToggleGroupItem
                :value="option.key"
                class="settings-bar__btn settings-bar__icon-btn data-active:text-primary data-[disabled]:pointer-events-auto"
                :disabled="reasonOf(option) !== null"
                :aria-label="t(option.i18nKey)"
              >
                <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="top">{{ titleOf(option) }}</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </div>

      <ToggleGroup
        class="max-sm:flex-wrap max-sm:justify-center"
        :model-value="config.mode"
        :aria-label="modeOption.ariaLabel"
        @update:model-value="onMode"
      >
        <ToggleGroupItem
          v-for="value in modeValues"
          :key="value"
          :value="value"
          class="settings-bar__btn data-[disabled]:pointer-events-auto"
          :disabled="modeReason(value) !== null"
          :title="modeReason(value) ?? undefined"
        >
          <component :is="modeIconOf(value)" v-if="modeIconOf(value)" aria-hidden="true" />
          {{ t(`${modeOption.valueI18nPrefix}.${value}`) }}
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- The amount for the current mode: seconds, words, or a quote's length band. -->
      <div class="settings-bar__zone settings-bar__zone--end">
        <ToggleGroup
          v-if="dimension"
          class="max-sm:flex-wrap max-sm:justify-center"
          :model-value="String(config[dimension.key])"
          :aria-label="dimension.ariaLabel"
          @update:model-value="onDimension(dimension, $event)"
        >
          <ToggleGroupItem
            v-for="value in valuesOf(dimension)"
            :key="value"
            :value="value"
            class="settings-bar__btn data-[disabled]:pointer-events-auto"
            :disabled="raceLock !== null"
            :title="raceLock ?? undefined"
          >
            {{ labelOf(dimension, value) }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>

    <!--
      The phone's whole config: one button, the same settings behind it. The
      three zones above need ~700px side by side, and squeezed they wrap into
      stacked rows that re-centre on every mode switch.
    -->
    <button
      type="button"
      class="settings-bar__mobile"
      data-testid="mobile-test-settings"
      @click="openMobile"
    >
      <IconAdjustments aria-hidden="true" />
      {{ t('game.testSettings') }}
    </button>

    <!--
      Everything that does NOT shape the text, on one line in the order it is
      read: the view mods first (no space, blind, fading, flashlight), then what
      the text IS (the language), then how it is paced, then how it is graded.
      The mods are glyphs like the ones above; difficulty keeps its words because
      it carries a LEVEL, which no glyph can say, and pace names a strategy.
    -->
    <div class="settings-bar__lang-row">
      <span
        v-if="repeated || (race.racing && config.mode !== ConfigModes.Quote)"
        class="settings-bar__repeated"
        data-testid="race-repeated"
      >
        {{ t('game.repeated') }}
      </span>

      <!-- Flags: one click is the whole interaction, so they need no popover. -->
      <div class="settings-bar__flags">
        <Tooltip v-for="option in flagSettings" :key="option.key">
          <TooltipTrigger as-child>
            <button
              type="button"
              :class="chipClass(config[option.key] === true, true)"
              :aria-label="t(option.i18nKey)"
              :aria-pressed="config[option.key] === true"
              :disabled="raceLock !== null"
              @click="onFlag(option)"
            >
              <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ raceLock === null ? t(option.i18nKey) : `${t(option.i18nKey)} — ${raceLock}` }}
          </TooltipContent>
        </Tooltip>
      </div>
      <button
        type="button"
        :class="chipClass(true)"
        data-testid="language-picker"
        :disabled="raceLock !== null"
        :title="raceLock ?? undefined"
        :aria-label="`${t('game.language')}: ${languageName(config.language)}`"
        @click="languageOpen = true"
      >
        <component :is="OPTION_ICONS.language" aria-hidden="true" />
        {{ languageName(config.language) }}
      </button>
      <PacePicker />

      <!-- Graded settings (difficulty): the values in a small popover. Last on
           the line — it is the only one here that changes how a run is SCORED
           rather than what it contains. -->
      <Popover v-for="option in gradedSettings" :key="option.key">
        <PopoverTrigger
          :class="chipClass(isCustom(option))"
          :disabled="raceLock !== null"
          :title="raceLock ?? undefined"
        >
          <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
          {{ t(option.i18nKey) }}: {{ labelOf(option, String(config[option.key])) }}
        </PopoverTrigger>
        <PopoverContent class="w-auto">
          <ToggleGroup
            :model-value="String(config[option.key])"
            :aria-label="option.ariaLabel"
            @update:model-value="onGraded(option, $event)"
          >
            <ToggleGroupItem
              v-for="value in valuesOf(option)"
              :key="value"
              :value="value"
              class="settings-bar__btn"
            >
              {{ labelOf(option, value) }}
            </ToggleGroupItem>
          </ToggleGroup>
        </PopoverContent>
      </Popover>
    </div>

    <LanguageModal
      v-model:open="languageOpen"
      :model-value="config.language"
      @update:model-value="onLanguage"
    />

    <!-- Mounted only once it has been asked for: it sets up a second set of
         registry computeds, and the bar stays mounted (hidden) for the whole of
         every run, so a desktop reader would pay for a surface they never open. -->
    <MobileTestConfig v-if="mobileEverOpened" v-model:open="mobileOpen" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useQuery } from '@tanstack/vue-query'
  import clsx from 'clsx'

  import { useConfigStore } from '@/entities/config'
  import { useRaceStore } from '@entities/race'
  import { toast } from '@/shared/ui/sonner'
  import {
    OPTION_ICONS,
    disabledReason,
    modeIconOf,
    optionOf,
    presetsFor,
    valuesFor,
    visibleOptionsFor,
    type ConstraintContext,
    type GameOption
  } from '@/entities/game'
  import { languageHasQuotesQueryOptions } from '@shared/api'
  import { ConfigModes, type Config } from '@/shared/constants/type'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import { LanguageModal } from '@/features/modal/language'
  import { PacePicker } from '@/features/test/pace'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import IconAdjustments from '~icons/tabler/adjustments-horizontal'

  import MobileTestConfig from './mobile.vue'

  /**
   * Solo settings above the typing field, laid out as monkeytype's: a bar of
   * three groups for everything that shapes the TEXT, and a notice line below it
   * for everything that only changes how the run is scored.
   *
   * Which options exist, which values they take and when they are unavailable all
   * come from the game-config registry filtered to the `solo` context — this file
   * owns the layout and the writes. The split between the two rows is the
   * registry's own `slot` plus the amount/mode keys the bar draws by name.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config
  const { languageName } = useLanguageNames()

  /**
   * The page's word: the CURRENT solo run replays a text the player has
   * already seen in full (the results screen's "restart"). Drives the same
   * red "repeated" mark a race shows — either way the text is pre-known and
   * the run never ranks.
   */
  defineProps<{ repeated?: boolean }>()

  const modeOption = optionOf('mode')
  const modeValues = computed(() => valuesFor(modeOption, 'solo'))

  /**
   * Constraint input: the run's intent. No quote is drawn yet at this point.
   * While the solo screen races a record the whole bar locks through the
   * registry's own mechanics (`racing` short-circuits every disabledWhen):
   * the setup on screen is the record's, and changing it IS exiting the race.
   */
  const race = useRaceStore()
  const ctx = computed<ConstraintContext>(() => ({
    mode: config.mode,
    ...(race.racing ? { racing: true as const } : {})
  }))
  /** The one lock reason every non-registry control shares while racing. */
  const raceLock = computed<string | null>(() => (race.racing ? t('game.constraint.racing') : null))
  const soloOptions = computed(() => visibleOptionsFor('solo', ctx.value))

  /** The keys the bar draws itself; everything else in `solo` is a notice chip. */
  const AMOUNT_KEYS = ['time', 'words', 'quoteGroup']
  const BAR_KEYS = ['mode', 'language', ...AMOUNT_KEYS]

  const isTextMod = (option: GameOption): boolean =>
    option.slot === 'generation' && option.control.kind === 'boolean'

  const textMods = computed(() => soloOptions.value.filter(isTextMod))
  const activeTextMods = computed(() =>
    textMods.value.filter((option) => config[option.key] === true).map((option) => option.key)
  )

  /**
   * The text mods the bar RENDERS. A mod gated by the mode itself (quote's
   * fixed text — toggling it would change nothing) leaves the bar entirely
   * instead of sitting greyed out; the constraint context here deliberately
   * omits `racing`, because a race lock is temporary and the record's setup
   * must stay readable — those render disabled in place, exactly as before.
   * Writes still run over the full `textMods` list, so a hidden mod keeps its
   * stored value the same way a disabled one always has.
   */
  const visibleTextMods = computed(() =>
    textMods.value.filter((option) => disabledReason(option, { mode: config.mode }) === null)
  )

  /** The one amount control the current mode makes visible. */
  const dimension = computed(() =>
    soloOptions.value.find((option) => AMOUNT_KEYS.includes(option.key))
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

  const CHIP =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-tm focus-ring [&_svg]:size-3.5'

  /**
   * `iconOnly` chips are the view mods, and they are the ONE control here whose
   * value you can only read from its own appearance — there is no label saying
   * "on". A text chip could get away with brightening from `sub` to `text`,
   * because the word beside it is already telling you what it is; a lone glyph
   * that only brightens says nothing, and the mods row read as uniformly off no
   * matter what was enabled.
   *
   * So an active view mod takes the same filled `main` pill the toggle groups
   * above it use. One rule across the whole bar: filled blue means on.
   *
   * It also widens the glyph and squares the padding — at 3.5 units in a box
   * sized for text, a lone icon reads as a dropped label rather than a control.
   */
  const chipClass = (active: boolean, iconOnly = false): string =>
    clsx(
      CHIP,
      iconOnly
        ? [
            'px-1 [&_svg]:size-4',
            active
              ? 'bg-main text-bg hover:brightness-110'
              : 'text-sub hover:bg-sub-alt hover:text-text'
          ]
        : active
          ? 'text-text'
          : 'text-sub opacity-60 hover:opacity-100'
    )

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

  const languageOpen = ref(false)

  const mobileOpen = ref(false)
  /** Latches on the first open — the mount gate for the modal. */
  const mobileEverOpened = ref(false)
  const openMobile = (): void => {
    mobileEverOpened.value = true
    mobileOpen.value = true
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

  /**
   * Only 86 of the catalogue's 430 languages have a quote corpus (QUOTES.md), so
   * quote mode can become unrunnable just by picking a language. Fall back to
   * words and say why, instead of leaving the run setup to fail with a 404.
   *
   * A watcher rather than a hook in the picker's callback: a persisted config
   * holds the language AND the mode, so it can restore the same dead pair on boot.
   */
  watch([() => config.mode, quotesAvailable], ([mode, available]) => {
    if (mode !== ConfigModes.Quote || available !== false) return
    configStore.setMode(ConfigModes.Words)
    toast.warning(t('game.quote.noneSwitched', { lang: languageName(config.language) }))
  })
</script>

<style lang="scss" scoped>
  // No outer margin: the stage's band owns the distance to the words.
  .settings-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;

    &__row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      justify-content: center;
    }

    /*
     * mods | mode | amount. Equal `1fr` sides put the middle column's centre at
     * the bar's centre no matter what the sides hold, which is what keeps the
     * mode group still while the sides change width — no reserved widths needed.
     *
     * Below `sm` it becomes three stacked centred rows: side by side the three
     * zones need ~700px, and squeezing them wraps each group internally instead,
     * which is worse than three tidy lines.
     */
    &__primary {
      display: none;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: 0.75rem;
      place-items: center;
      width: 100%;

      @media (width >= 640px) {
        display: grid;
      }
    }

    // The phone's config trigger — the row's stand-in below `sm`.
    &__mobile {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--sub-color);
      cursor: pointer;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius, 0.375rem);
      transition: color var(--transition-duration, 0.125s) linear;

      &:hover {
        color: var(--text-color);
      }

      &:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 1.5px var(--bg-color),
          0 0 0 3px var(--text-color);
      }

      :deep(svg) {
        width: 1rem;
        height: 1rem;
      }

      @media (width >= 640px) {
        display: none;
      }
    }

    // The side zones face INWARD, so the three groups stay one cluster over the
    // field rather than being pushed out to the page edges.
    &__zone {
      display: flex;
      justify-content: center;

      @media (width >= 640px) {
        &--start {
          justify-content: flex-end;
        }

        &--end {
          justify-content: flex-start;
        }
      }
    }

    &__flags {
      display: flex;
      gap: 0.125rem;
      align-items: center;
    }

    // Square: a lone glyph in a box padded for a word sits off-centre in it.
    &__icon-btn {
      padding-inline: 0.625rem;
    }

    // The notice line is gone: its flags moved to the head of the row below and
    // difficulty to its tail, so there is nothing left to lay out.
    &__lang-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
      align-items: center;
      justify-content: center;
    }

    // The race's warning colour on purpose: a repeated text never ranks.
    &__repeated {
      font-size: 0.75rem;
      color: var(--error-color);
      text-transform: lowercase;
      user-select: none;
    }
  }
</style>
