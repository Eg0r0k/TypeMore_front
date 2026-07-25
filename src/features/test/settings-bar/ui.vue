<template>
  <div
    class="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 py-2.5 text-sm text-sub"
  >
    <!-- modifiers (multi-select) -->
    <ToggleGroup
      type="multiple"
      :model-value="activeToggles"
      aria-label="modifiers"
      @update:model-value="setActiveToggles"
    >
      <ToggleGroupItem v-for="key in toggles" :key="key" :value="key" class="settings-bar__btn">
        {{ t(`game.${key}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- mode: time | words (single) -->
    <ToggleGroup :model-value="config.mode" aria-label="mode" @update:model-value="onMode">
      <ToggleGroupItem v-for="m in modes" :key="m" :value="m" class="settings-bar__btn">
        {{ t(`game.mode.${m === ConfigModes.Time ? 'time' : 'words'}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- amount presets (single) -->
    <ToggleGroup
      :model-value="String(currentAmount)"
      aria-label="amount"
      @update:model-value="onPreset"
    >
      <ToggleGroupItem
        v-for="preset in presets"
        :key="preset"
        :value="String(preset)"
        class="settings-bar__btn"
      >
        {{ preset }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- difficulty (single) -->
    <ToggleGroup
      :model-value="config.difficulty"
      aria-label="difficulty"
      @update:model-value="onDifficulty"
    >
      <ToggleGroupItem v-for="d in difficulties" :key="d" :value="d" class="settings-bar__btn">
        {{ t(`game.difficulty.${d}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <!-- min speed floor (single) -->
    <label class="flex items-center gap-2 text-sub">
      {{ t('game.minSpeed') }}
      <ToggleGroup
        :model-value="String(config.minWpm)"
        aria-label="min speed"
        @update:model-value="onMinSpeed"
      >
        <ToggleGroupItem
          v-for="ms in minSpeedOptions"
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
      {{ t('game.language') }}
      <button
        type="button"
        class="transition-tm focus-ring inline-flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-sub hover:text-text"
        @click="languageOpen = true"
      >
        {{ config.language }}
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
  import { ConfigModes } from '@/shared/constants/type'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { LanguageModal } from '@/features/modal/language'

  /**
   * Compact game settings bar. Writes straight into the persisted config store;
   * core-bound options trigger the GameField rebuild-on-change, `blind` applies
   * live. No local state, no rules — just the existing config fields.
   *
   * The rendering layer is shadcn ToggleGroup + the console language modal, but
   * every write below is identical to the previous bar (setMode/setTime/setWords/
   * setLanguage, direct config.difficulty, config[toggle] flip) so the home-page
   * rebuild-run watcher semantics are unchanged.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  type ToggleKey =
    | 'punctuation'
    | 'numbers'
    | 'randomCase'
    | 'nospace'
    | 'reverse'
    | 'blind'
    | 'fading'
    | 'flashlight'
  const toggles: ToggleKey[] = [
    'punctuation',
    'numbers',
    'randomCase',
    'nospace',
    'reverse',
    'blind',
    'fading',
    'flashlight'
  ]
  // Multi-select model over the boolean flags. The setter writes each flag to its
  // membership in the selection; unchanged flags resolve to the same value and do
  // not re-trigger reactivity (so only the flipped flag fires the watcher).
  const activeToggles = computed<ToggleKey[]>(() => toggles.filter((key) => config[key]))
  const setActiveToggles = (value: unknown): void => {
    const next = (Array.isArray(value) ? value : []) as ToggleKey[]
    for (const key of toggles) config[key] = next.includes(key)
  }

  const modes = [ConfigModes.Words, ConfigModes.Time]
  const onMode = (value: unknown): void => {
    if (value) configStore.setMode(value as ConfigModes)
  }

  const difficulties = ['normal', 'expert', 'master'] as const
  const onDifficulty = (value: unknown): void => {
    if (value) config.difficulty = value as (typeof difficulties)[number]
  }

  const minSpeedOptions = [0, 60, 80, 100]
  const onMinSpeed = (value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    configStore.setConfig('minWpm', Number(value))
  }

  const WORD_PRESETS = [10, 25, 50, 100]
  const TIME_PRESETS = [15, 30, 60, 120]
  const presets = computed(() => (config.mode === ConfigModes.Time ? TIME_PRESETS : WORD_PRESETS))
  const currentAmount = computed(() =>
    config.mode === ConfigModes.Time ? config.time : config.words
  )
  const onPreset = (value: unknown): void => {
    if (value === null || value === undefined || value === '') return
    const amount = Number(value)
    if (config.mode === ConfigModes.Time) configStore.setTime(amount)
    else configStore.setWords(amount)
  }

  const languageOpen = ref(false)
  const onLanguage = (value: string): void => {
    void configStore.setLanguage(value)
  }
</script>
