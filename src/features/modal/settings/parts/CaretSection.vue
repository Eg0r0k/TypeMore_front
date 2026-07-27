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

  import { useConfigStore } from '@/entities/config'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import type { CaretStyle, SmoothCaret } from '@/shared/constants/type'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import SettingRow from './SettingRow.vue'

  const SMOOTH_CARET: readonly SmoothCaret[] = ['off', 'slow', 'medium', 'fast']
  const CARET_STYLES: readonly CaretStyle[] = ['off', 'default', 'block', 'outline', 'underline']

  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  const onSmooth = (value: unknown): void => {
    const smooth = narrowTo(SMOOTH_CARET, value)
    if (smooth !== null) configStore.setConfig('smoothCaret', smooth)
  }

  const onStyle = (value: unknown): void => {
    const style = narrowTo(CARET_STYLES, value)
    if (style !== null) configStore.setConfig('caretStyle', style)
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
