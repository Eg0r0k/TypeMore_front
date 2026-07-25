<template>
  <div class="settings-section">
    <SettingRow id="smoothCaret">
      <ToggleGroup
        :model-value="config.smoothCaret"
        :aria-label="t('settings.smoothCaret.label')"
        @update:model-value="onSmooth"
      >
        <ToggleGroupItem v-for="value in SMOOTH_CARET" :key="value" :value="value">
          {{ value === 'off' ? t('settings.value.off') : t(`settings.smoothCaret.${value}`) }}
        </ToggleGroupItem>
      </ToggleGroup>
    </SettingRow>

    <SettingRow id="caretStyle">
      <ToggleGroup
        class="flex-wrap"
        :model-value="config.caretStyle"
        :aria-label="t('settings.caretStyle.label')"
        @update:model-value="onStyle"
      >
        <ToggleGroupItem v-for="value in CARET_STYLES" :key="value" :value="value">
          {{ value === 'off' ? t('settings.value.off') : t(`settings.caretStyle.${value}`) }}
        </ToggleGroupItem>
      </ToggleGroup>
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config/model/store'
  import type { CaretStyle, SmoothCaret } from '@/shared/constants/type'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import SettingRow from './SettingRow.vue'

  const SMOOTH_CARET: readonly SmoothCaret[] = ['off', 'slow', 'medium', 'fast']
  const CARET_STYLES: readonly CaretStyle[] = ['off', 'default', 'block', 'outline', 'underline']

  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  const onSmooth = (value: unknown): void => {
    if (typeof value === 'string' && (SMOOTH_CARET as readonly string[]).includes(value)) {
      configStore.setConfig('smoothCaret', value as SmoothCaret)
    }
  }

  const onStyle = (value: unknown): void => {
    if (typeof value === 'string' && (CARET_STYLES as readonly string[]).includes(value)) {
      configStore.setConfig('caretStyle', value as CaretStyle)
    }
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
