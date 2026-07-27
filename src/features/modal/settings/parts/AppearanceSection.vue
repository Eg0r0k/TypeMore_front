<template>
  <div class="settings-section">
    <SettingRow id="uiLanguage">
      <Select :model-value="language" @update:model-value="onUiLanguage">
        <SelectTrigger class="w-44" :aria-label="t('settings.uiLanguage.label')">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{{ t('settings.uiLanguage.system') }}</SelectItem>
          <SelectItem v-for="locale in SUPPORTED_LOCALES" :key="locale" :value="locale">
            {{ LOCALE_NATIVE[locale] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>

    <SettingRow id="fontFamily">
      <Combobox
        class="w-44"
        :options="[...FONT_FAMILIES]"
        :model-value="config.fontFamily"
        :placeholder="config.fontFamily"
        @update:model-value="onFontFamily"
      />
    </SettingRow>

    <SettingRow id="fontSize">
      <Slider
        class="w-44"
        :model-value="[config.fontSize]"
        :min="FONT_SIZE_MIN"
        :max="FONT_SIZE_MAX"
        :step="FONT_SIZE_STEP"
        :aria-label="t('settings.fontSize.label')"
        @update:model-value="onFontSize"
      />
      <Typography size="xs" color="sub" tag-name="span">{{ config.fontSize }}px</Typography>
    </SettingRow>

    <SettingRow id="showFps">
      <Switch
        :model-value="config.showFps"
        :aria-label="t('settings.showFps.label')"
        @update:model-value="configStore.setFPS"
      />
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
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
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
  import { Slider } from '@/shared/ui/slider'
  import { Switch } from '@/shared/ui/switch'
  import { Typography } from '@/shared/ui/typography'
  import SettingRow from './SettingRow.vue'

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
