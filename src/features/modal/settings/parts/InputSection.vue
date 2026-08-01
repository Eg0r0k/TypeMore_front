<template>
  <div class="settings-section">
    <SettingRow id="freedomMode">
      <Switch
        :model-value="config.freedomMode"
        :aria-label="t('settings.freedomMode.label')"
        @update:model-value="(value) => configStore.setConfig('freedomMode', value)"
      />
    </SettingRow>

    <SettingRow id="stopOnError">
      <!-- Three options, so it stays a segmented group: all of them are visible
           at once and it still fits the row's control rail. Stretched to that
           rail so it lines up with the dropdowns and sliders in other rows. -->
      <ToggleGroup
        class="w-full"
        :model-value="config.stopOnError"
        :aria-label="t('settings.stopOnError.label')"
        @update:model-value="onStopOnError"
      >
        <ToggleGroupItem v-for="value in STOP_ON_ERROR" :key="value" class="flex-1" :value="value">
          {{ value === 'off' ? t('settings.value.off') : t(`settings.stopOnError.${value}`) }}
        </ToggleGroupItem>
      </ToggleGroup>
    </SettingRow>

    <SettingRow id="quickEnd">
      <Switch
        :model-value="config.quickEnd"
        :aria-label="t('settings.quickEnd.label')"
        @update:model-value="(value) => configStore.setConfig('quickEnd', value)"
      />
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import type { StopOnError } from '@/shared/constants/type'
  import { Switch } from '@/shared/ui/switch'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import SettingRow from './SettingRow.vue'

  /** Input behaviour. Every field here is core-bound: changing one rebuilds the run. */
  const STOP_ON_ERROR: readonly StopOnError[] = ['off', 'word', 'letter']

  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  const onStopOnError = (value: unknown): void => {
    const stop = narrowTo(STOP_ON_ERROR, value)
    if (stop !== null) configStore.setConfig('stopOnError', stop)
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
