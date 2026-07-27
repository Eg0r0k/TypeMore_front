<template>
  <div class="settings-bar">
    <!--
      The bar proper: text mods | modes | amount, monkeytype's three groups. Only
      what shapes the TEXT lives here, and each group is one ToggleGroup, so the
      pills and the separators between them carry the grouping.
    -->
    <div class="settings-bar__row">
      <ToggleGroup
        v-if="textMods.length"
        type="multiple"
        :model-value="activeTextMods"
        aria-label="text modifiers"
        @update:model-value="onTextMods"
      >
        <ToggleGroupItem
          v-for="option in textMods"
          :key="option.key"
          :value="option.key"
          class="settings-bar__btn"
          :disabled="reasonOf(option) !== null"
          :title="titleOf(option)"
        >
          <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
          {{ t(option.i18nKey) }}
        </ToggleGroupItem>
      </ToggleGroup>

      <span class="settings-bar__sep" aria-hidden="true"></span>

      <ToggleGroup
        :model-value="config.mode"
        :aria-label="modeOption.ariaLabel"
        @update:model-value="onMode"
      >
        <ToggleGroupItem
          v-for="value in modeValues"
          :key="value"
          :value="value"
          class="settings-bar__btn"
          :disabled="modeReason(value) !== null"
          :title="modeReason(value) ?? undefined"
        >
          <component :is="modeIconOf(value)" v-if="modeIconOf(value)" aria-hidden="true" />
          {{ t(`${modeOption.valueI18nPrefix}.${value}`) }}
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- The amount for the current mode: seconds, words, or a quote's length band. -->
      <template v-if="dimension">
        <span class="settings-bar__sep" aria-hidden="true"></span>

        <ToggleGroup
          :model-value="String(config[dimension.key])"
          :aria-label="dimension.ariaLabel"
          @update:model-value="onDimension(dimension, $event)"
        >
          <ToggleGroupItem
            v-for="value in valuesOf(dimension)"
            :key="value"
            :value="value"
            class="settings-bar__btn"
          >
            {{ labelOf(dimension, value) }}
          </ToggleGroupItem>
        </ToggleGroup>
      </template>
    </div>

    <!--
      The notice line (monkeytype's `#testModesNotice`): the settings that do not
      shape the text, as small grey chips — highlighted when they are not at their
      default, so the line reads as "what is unusual about this run".
    -->
    <div class="settings-bar__notice">
      <!-- Graded settings (difficulty, speed floor): the values in a small popover. -->
      <Popover v-for="option in gradedSettings" :key="option.key">
        <PopoverTrigger :class="chipClass(isCustom(option))">
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

      <!-- Flags: one click is the whole interaction, so they need no popover. -->
      <button
        v-for="option in flagSettings"
        :key="option.key"
        type="button"
        :class="chipClass(config[option.key] === true)"
        :aria-pressed="config[option.key] === true"
        @click="onFlag(option)"
      >
        <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
        {{ t(option.i18nKey) }}
      </button>
    </div>

    <!-- Last above the field: the language names what is in it. -->
    <button
      type="button"
      :class="chipClass(true)"
      data-testid="language-picker"
      :aria-label="`${t('game.language')}: ${languageName(config.language)}`"
      @click="languageOpen = true"
    >
      <component :is="OPTION_ICONS.language" aria-hidden="true" />
      {{ languageName(config.language) }}
    </button>

    <LanguageModal
      v-model:open="languageOpen"
      :model-value="config.language"
      @update:model-value="onLanguage"
    />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useQuery } from '@tanstack/vue-query'
  import clsx from 'clsx'

  import { useConfigStore } from '@/entities/config'
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
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
  import { LanguageModal } from '@/features/modal/language'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'

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

  const modeOption = optionOf('mode')
  const modeValues = computed(() => valuesFor(modeOption, 'solo'))

  /** Constraint input: the run's intent. No quote is drawn yet at this point. */
  const ctx = computed<ConstraintContext>(() => ({ mode: config.mode }))
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

  /** The one amount control the current mode makes visible. */
  const dimension = computed(() =>
    soloOptions.value.find((option) => AMOUNT_KEYS.includes(option.key))
  )

  const noticeOptions = computed(() =>
    soloOptions.value.filter((option) => !BAR_KEYS.includes(option.key) && !isTextMod(option))
  )
  const gradedSettings = computed(() =>
    noticeOptions.value.filter((option) => option.control.kind !== 'boolean')
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

  const chipClass = (active: boolean): string =>
    clsx(CHIP, active ? 'text-text' : 'text-sub opacity-60 hover:opacity-100')

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
    if (value) configStore.setMode(value as ConfigModes)
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
    value === ConfigModes.Quote && quotesAvailable.value === false
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

    &__sep {
      width: 1px;
      height: 1.25rem;
      background-color: var(--sub-color);
      opacity: 0.25;
    }

    &__notice {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
      align-items: center;
      justify-content: center;
    }

    // Reserved whether it has anything to say or not — see the template.
    &__note {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      min-height: 1.0625rem;
      font-size: 0.75rem;
      color: var(--sub-color);
      opacity: 0.6;
    }
  }
</style>
