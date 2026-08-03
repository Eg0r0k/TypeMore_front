<template>
  <div class="settings-section">
    <SettingRow id="uiLanguage">
      <SettingSelect
        :model-value="language"
        :options="languageOptions"
        :label="t('settings.uiLanguage.label')"
        @update="onUiLanguage"
      />
    </SettingRow>

    <SettingRow id="fontFamily">
      <Combobox
        class="w-full"
        :options="[...FONT_FAMILIES]"
        :model-value="config.fontFamily"
        :placeholder="config.fontFamily"
        @update:model-value="onFontFamily"
      />
    </SettingRow>

    <SettingRow id="fontSize">
      <Slider
        class="min-w-0 flex-1"
        :model-value="[config.fontSize]"
        :min="FONT_SIZE_MIN"
        :max="FONT_SIZE_MAX"
        :step="FONT_SIZE_STEP"
        :aria-label="t('settings.fontSize.label')"
        @update:model-value="onFontSize"
      />
      <Typography
        size="xs"
        color="sub"
        tag-name="span"
        class="w-10 shrink-0 text-right tabular-nums"
      >
        {{ config.fontSize }}px
      </Typography>
    </SettingRow>

    <SettingRow id="showFps">
      <Switch
        :model-value="config.showFps"
        :aria-label="t('settings.showFps.label')"
        @update:model-value="(v) => configStore.setConfig('showFps', v)"
      />
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config'
  import {
    FONT_FAMILIES,
    FONT_SIZE_MAX,
    FONT_SIZE_MIN,
    FONT_SIZE_STEP
  } from '@/shared/constants/fonts'
  import { SUPPORTED_LOCALES, type UiLanguage } from '@/shared/lib/i18n/locale'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import { useUiLanguage } from '@/shared/lib/hooks/useUiLanguage'
  import { Combobox } from '@/shared/ui/combobox'
  import { Slider } from '@/shared/ui/slider'
  import { Switch } from '@/shared/ui/switch'
  import { Typography } from '@/shared/ui/typography'
  import SettingRow from './SettingRow.vue'
  import SettingSelect, { type SettingOption } from './SettingSelect.vue'

  /** Endonyms: a language is always listed in its own words. */
  const LOCALE_NATIVE: Record<string, string> = { en: 'English', ru: 'Русский' }
  const UI_LANGUAGES: readonly UiLanguage[] = ['system', ...SUPPORTED_LOCALES]

  /**
   * Font family and size are applied through the store setters (they also push
   * the `--font` / `--tm-font-size` custom properties), not by writing config
   * directly — the CSS variables are the half that actually renders.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config
  const { language, setLanguage } = useUiLanguage()

  const languageOptions = computed<SettingOption[]>(() =>
    UI_LANGUAGES.map((value) => ({
      value,
      label: value === 'system' ? t('settings.uiLanguage.system') : (LOCALE_NATIVE[value] ?? value)
    }))
  )

  const onUiLanguage = (value: unknown): void => {
    const lang = narrowTo(UI_LANGUAGES, value)
    if (lang !== null) setLanguage(lang)
  }

  const onFontFamily = (value: string | undefined): void => {
    if (value) configStore.setFontFamily(value)
  }

  const onFontSize = (value: number[] | undefined): void => {
    const next = value?.[0]
    if (next !== undefined) configStore.setFontSize(next)
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
