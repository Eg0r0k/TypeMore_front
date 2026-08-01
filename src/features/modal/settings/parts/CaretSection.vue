<template>
  <div class="settings-section">
    <SettingRow id="smoothCaret">
      <SettingSelect
        :model-value="config.smoothCaret"
        :options="smoothOptions"
        :label="t('settings.smoothCaret.label')"
        @update="onSmooth"
      />
    </SettingRow>

    <SettingRow id="caretStyle">
      <SettingSelect
        :model-value="config.caretStyle"
        :options="styleOptions"
        :label="t('settings.caretStyle.label')"
        @update="onStyle"
      />
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import type { CaretStyle, SmoothCaret } from '@/shared/constants/type'
  import SettingRow from './SettingRow.vue'
  import SettingSelect, { type SettingOption } from './SettingSelect.vue'

  /**
   * Four speeds and five styles — past the point where a segmented group is
   * readable, so both are dropdowns. `caretStyle` was the worst of the two: five
   * segments overflowed the row and pushed the group off its own column.
   */
  const SMOOTH_CARET: readonly SmoothCaret[] = ['off', 'slow', 'medium', 'fast']
  const CARET_STYLES: readonly CaretStyle[] = ['off', 'default', 'block', 'outline', 'underline']

  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  /** `off` is a shared word, so it comes from `settings.value`, not per-setting. */
  const optionsFor = (setting: string, values: readonly string[]): SettingOption[] =>
    values.map((value) => ({
      value,
      label: value === 'off' ? t('settings.value.off') : t(`settings.${setting}.${value}`)
    }))

  const smoothOptions = computed(() => optionsFor('smoothCaret', SMOOTH_CARET))
  const styleOptions = computed(() => optionsFor('caretStyle', CARET_STYLES))

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
