<template>
  <div
    class="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 py-2.5 text-sm text-sub"
  >
    <!-- modifiers (multi-select) — every boolean the registry puts in this context -->
    <ToggleGroup
      type="multiple"
      :model-value="activeToggles"
      aria-label="modifiers"
      @update:model-value="setActiveToggles"
    >
      <ToggleGroupItem
        v-for="option in toggleOptions"
        :key="option.key"
        :value="option.key"
        :disabled="reasonOf(option) !== null"
        :title="titleOf(option)"
        class="settings-bar__btn"
      >
        {{ t(option.i18nKey) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- why a disabled modifier is disabled — the registry's reason, rendered once -->
    <span v-for="reason in activeReasons" :key="reason" class="settings-bar__reason">
      {{ t(reason) }}
    </span>

    <!-- mode: the values this context accepts (solo adds `quote`; a room does not) -->
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
      >
        {{ t(`${modeOption.valueI18nPrefix}.${value}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!--
      The dimension control, whichever one the current mode makes visible:
      seconds, word count, or a quote's length band. Exactly one is ever shown —
      `visibleWhen` in the registry decides, not a chain of `v-if`s here.
    -->
    <template v-if="dimension">
      <ToggleGroup
        v-if="dimension.control.kind === 'presets'"
        :model-value="String(config[dimension.key])"
        :aria-label="dimension.ariaLabel"
        @update:model-value="onDimensionPreset"
      >
        <ToggleGroupItem
          v-for="preset in presetsFor(dimension)"
          :key="preset"
          :value="String(preset)"
          class="settings-bar__btn"
        >
          {{ preset }}
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- A plain wrapper, not a <label>: the group already labels itself. -->
      <div v-else class="flex items-center gap-2 text-sub">
        <span>{{ t(dimension.i18nKey) }}</span>
        <ToggleGroup
          :model-value="String(config[dimension.key])"
          :aria-label="dimension.ariaLabel"
          @update:model-value="onDimensionEnum"
        >
          <ToggleGroupItem
            v-for="value in valuesFor(dimension, 'solo')"
            :key="value"
            :value="value"
            class="settings-bar__btn"
          >
            {{ t(`${dimension.valueI18nPrefix}.${value}`) }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </template>

    <!-- difficulty (single) -->
    <ToggleGroup
      :model-value="config.difficulty"
      :aria-label="difficultyOption.ariaLabel"
      @update:model-value="onDifficulty"
    >
      <ToggleGroupItem
        v-for="value in valuesFor(difficultyOption, 'solo')"
        :key="value"
        :value="value"
        class="settings-bar__btn"
      >
        {{ t(`${difficultyOption.valueI18nPrefix}.${value}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- min speed floor (single) -->
    <label class="flex items-center gap-2 text-sub">
      {{ t(minWpmOption.i18nKey) }}
      <ToggleGroup
        :model-value="String(config.minWpm)"
        :aria-label="minWpmOption.ariaLabel"
        @update:model-value="onMinSpeed"
      >
        <ToggleGroupItem
          v-for="ms in presetsFor(minWpmOption)"
          :key="ms"
          :value="String(ms)"
          class="settings-bar__btn"
        >
          {{ ms === 0 ? t('game.minSpeedOff') : ms }}
        </ToggleGroupItem>
      </ToggleGroup>
    </label>

    <!-- language (searchable console modal) -->
    <label class="flex items-center gap-2 text-sub">
      {{ t(languageOption.i18nKey) }}
      <button
        type="button"
        class="transition-tm focus-ring inline-flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-sub hover:text-text"
        @click="languageOpen = true"
      >
        {{ languageName(config.language) }}
      </button>
    </label>

    <LanguageModal
      v-model:open="languageOpen"
      :model-value="config.language"
      @update:model-value="onLanguage"
    />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config/model/store'
  import {
    disabledReason,
    optionOf,
    presetsFor,
    valuesFor,
    visibleOptionsFor,
    type ConstraintContext,
    type GameOption
  } from '@/entities/game'
  import { ConfigModes, type Config, type QuoteGroup } from '@/shared/constants/type'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { LanguageModal } from '@/features/modal/language'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'

  /** The `Config` fields the multi-select group writes — every boolean one. */
  type BooleanOptionKey = {
    [K in keyof Config]: Config[K] extends boolean ? K : never
  }[keyof Config]

  /**
   * Compact game settings bar, rendered from the game-config registry filtered
   * to the `solo` context. Which options exist, which values they accept and
   * when they are unavailable all come from that one table — this file owns only
   * the LAYOUT and the writes.
   *
   * The writes are deliberately unchanged from the pre-registry bar
   * (setMode/setTime/setWords/setLanguage, `setConfig` for quoteGroup/minWpm,
   * direct `config.difficulty` and `config[key]` for the flags), so the
   * home-page rebuild-run watcher semantics are exactly what they were.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  /** Constraint input: the run's intent. No quote is drawn yet at this point. */
  const ctx = computed<ConstraintContext>(() => ({ mode: config.mode }))

  const modeOption = optionOf('mode')
  const difficultyOption = optionOf('difficulty')
  const minWpmOption = optionOf('minWpm')
  const languageOption = optionOf('language')

  // The catalogue names the language; the config only ever holds its key.
  const { languageName } = useLanguageNames()

  const modeValues = computed(() => valuesFor(modeOption, 'solo'))

  /** Every boolean this context owns, in registry order. */
  const toggleOptions = computed(() =>
    visibleOptionsFor('solo', ctx.value).filter((o) => o.control.kind === 'boolean')
  )

  /** The one dimension control the current mode makes visible. */
  const DIMENSION_KEYS: readonly string[] = ['time', 'words', 'quoteGroup']
  const dimension = computed(() =>
    visibleOptionsFor('solo', ctx.value).find((o) => DIMENSION_KEYS.includes(o.key))
  )

  const reasonOf = (option: GameOption): string | null => disabledReason(option, ctx.value)
  const titleOf = (option: GameOption): string | undefined => {
    const reason = reasonOf(option)
    return reason ? t(reason) : undefined
  }

  /**
   * The distinct reasons currently gating something, so the bar explains itself
   * once instead of hiding the explanation in a tooltip nobody hovers.
   */
  const activeReasons = computed(() => [
    ...new Set(toggleOptions.value.map(reasonOf).filter((r): r is string => r !== null))
  ])

  // Multi-select model over the boolean flags. The setter writes each flag to its
  // membership in the selection; unchanged flags resolve to the same value and do
  // not re-trigger reactivity (so only the flipped flag fires the watcher).
  const activeToggles = computed<string[]>(() =>
    toggleOptions.value.filter((o) => config[o.key] === true).map((o) => o.key)
  )
  const setActiveToggles = (value: unknown): void => {
    const next = new Set(Array.isArray(value) ? (value as string[]) : [])
    // A gated flag keeps its stored value: a disabled item can never appear in
    // `next`, and writing that absence back would silently clear a setting the
    // player did not touch — so switching away from a quote restores them.
    for (const option of toggleOptions.value) {
      if (reasonOf(option) !== null) continue
      config[option.key as BooleanOptionKey] = next.has(option.key)
    }
  }

  const onMode = (value: unknown): void => {
    if (value) configStore.setMode(value as ConfigModes)
  }

  const onDimensionPreset = (value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    const amount = Number(value)
    if (config.mode === ConfigModes.Time) configStore.setTime(amount)
    else configStore.setWords(amount)
  }

  const onDimensionEnum = (value: unknown): void => {
    if (!value) return
    configStore.setConfig('quoteGroup', value as QuoteGroup)
  }

  const onDifficulty = (value: unknown): void => {
    if (value) config.difficulty = value as (typeof config)['difficulty']
  }

  const onMinSpeed = (value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    configStore.setConfig('minWpm', Number(value))
  }

  const languageOpen = ref(false)
  const onLanguage = (value: string): void => {
    void configStore.setLanguage(value)
  }
</script>

<style lang="scss" scoped>
  .settings-bar__reason {
    font-size: 0.75rem;
    color: var(--sub-color);
    opacity: 0.8;
  }
</style>
