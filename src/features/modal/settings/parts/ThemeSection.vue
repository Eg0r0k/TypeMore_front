<template>
  <div class="settings-section">
    <SettingRow id="theme">
      <Button color="main-outline" size="s" @click="nav?.openThemes()">
        {{ t('settings.theme.open') }}
      </Button>
    </SettingRow>

    <SettingRow id="background">
      <template #note>
        <Typography size="xxs" color="sub" tag-name="p">
          {{ t('settings.background.note') }}
        </Typography>
      </template>

      <div class="background">
        <div class="background__row">
          <TextInput
            v-model="urlDraft"
            class="background__url"
            :placeholder="t('settings.background.urlPlaceholder')"
            :aria-label="t('settings.background.url')"
            @keydown.enter="commitUrl"
            @blur="commitUrl"
          />
          <Button color="gray" size="s" @click="pickLocal">
            {{ t('settings.background.useLocal') }}
          </Button>
          <Button v-if="hasBackground" color="error-outline" size="s" @click="clearBackground">
            {{ t('settings.background.clear') }}
          </Button>
        </div>

        <input
          ref="fileRef"
          class="background__file"
          type="file"
          accept="image/*"
          @change="onFile"
        />

        <ToggleGroup
          :model-value="config.backgroundSize"
          :aria-label="t('settings.background.label')"
          @update:model-value="onSize"
        >
          <ToggleGroupItem v-for="value in BACKGROUND_SIZES" :key="value" :value="value">
            {{ t(`settings.background.${value}`) }}
          </ToggleGroupItem>
        </ToggleGroup>

        <Typography v-if="config.backgroundLocal" size="xxs" color="main" tag-name="p">
          {{ t('settings.background.localActive') }}
        </Typography>
        <Typography v-if="error" size="xxs" color="error" tag-name="p">{{ error }}</Typography>
      </div>
    </SettingRow>

    <SettingRow id="colors">
      <div class="colors">
        <label v-for="color in COLOR_VARS" :key="color" class="colors__swatch">
          <input
            class="colors__input"
            type="color"
            :value="refColors[color]"
            :aria-label="color"
            @input="onColor(color, $event)"
          />
          <Typography size="xxs" color="sub" tag-name="span">{{ label(color) }}</Typography>
        </label>
        <Button color="gray" size="s" @click="copyTheme">{{ t('settings.colors.copy') }}</Button>
      </div>
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, useTemplateRef, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDebounceFn } from '@vueuse/core'

  import { useConfigStore } from '@/entities/config'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import { SETTINGS_NAV } from '../model/registry'
  import type { BackgroundSize } from '@/shared/constants/type'
  import { readImageFile } from '@/shared/lib/helpers/image'
  import { useThemes } from '@/shared/lib/hooks/useThemes'
  import { validateConfig } from '@/shared/lib/helpers/validation'
  import { Button } from '@/shared/ui/button'
  import { toast } from '@/shared/ui/sonner'
  import { TextInput } from '@/shared/ui/input'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import SettingRow from './SettingRow.vue'

  /** The seven custom properties every theme defines (see `shared/api/themes`). */
  const COLOR_VARS = [
    '--bg-color',
    '--main-color',
    '--sub-color',
    '--sub-alt-color',
    '--text-color',
    '--error-color',
    '--error-extra-color'
  ] as const
  type ColorVar = (typeof COLOR_VARS)[number]

  const BACKGROUND_SIZES: readonly BackgroundSize[] = ['cover', 'contain', 'max']
  /** Local images ride along in the persisted config blob; localStorage caps at ~5 MB. */
  const MAX_LOCAL_IMAGE_BYTES = 2_000_000

  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config
  // The themes hook disconnects its own observer on scope dispose.
  const { refColors } = useThemes()

  const nav = inject(SETTINGS_NAV, undefined)
  const error = ref('')
  const urlDraft = ref(config.backgroundImg)
  const fileRef = useTemplateRef<HTMLInputElement>('fileRef')

  const hasBackground = computed(() => Boolean(config.backgroundImg || config.backgroundLocal))

  // A theme switch (or an import) rewrites the URL behind our back.
  watch(
    () => config.backgroundImg,
    (value) => {
      if (value !== urlDraft.value) urlDraft.value = value
    }
  )

  const commitUrl = (): void => {
    const next = String(urlDraft.value ?? '').trim()
    if (next === config.backgroundImg) return
    if (validateConfig('backgroundImg', next) !== true) {
      error.value = t('settings.background.error.invalidUrl')
      return
    }
    error.value = ''
    configStore.setConfig('backgroundImg', next)
  }

  const pickLocal = (): void => fileRef.value?.click()

  const onFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // re-picking the same file must fire `change` again
    if (!file) return
    try {
      const dataUrl = await readImageFile(file, MAX_LOCAL_IMAGE_BYTES)
      configStore.setConfig('backgroundLocal', dataUrl)
      error.value = ''
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? 'read_failed'
      error.value = t(`settings.background.error.${code}`, { limit: '2 MB' })
    }
  }

  const clearBackground = (): void => {
    configStore.setConfig('backgroundLocal', '')
    configStore.setConfig('backgroundImg', '')
    urlDraft.value = ''
    error.value = ''
  }

  const onSize = (value: unknown): void => {
    const size = narrowTo(BACKGROUND_SIZES, value)
    if (size !== null) configStore.setConfig('backgroundSize', size)
  }

  const label = (color: ColorVar): string => color.replace('--', '').replace('-color', '')

  // Live preview only: painting the root variable is what a theme does. Debounced
  // because a colour input fires on every pointer move across the picker.
  const applyColor = useDebounceFn((variable: ColorVar, value: string) => {
    document.documentElement.style.setProperty(variable, value)
  }, 120)

  const onColor = (variable: ColorVar, event: Event): void => {
    void applyColor(variable, (event.target as HTMLInputElement).value)
  }

  const copyTheme = async (): Promise<void> => {
    const theme = COLOR_VARS.reduce<Record<string, string>>(
      (acc, variable) => {
        acc[variable] = refColors[variable]
        return acc
      },
      { name: config.theme }
    )
    try {
      await navigator.clipboard.writeText(JSON.stringify(theme, null, 2))
      toast.success(t('settings.colors.copied'))
    } catch (cause) {
      toast.error(t('settings.colors.copyFailed'), { description: String(cause) })
    }
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }

  .background {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    width: 100%;

    @media (width >= 640px) {
      align-items: flex-end;
    }
  }

  .background__row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .background__url {
    width: 220px;
  }

  .background__file {
    display: none;
  }

  .colors {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .colors__swatch {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    cursor: pointer;
  }

  .colors__input {
    width: 34px;
    height: 26px;
    padding: 0;
    cursor: pointer;
    background: none;
    border: 1px solid var(--sub-color);
    border-radius: var(--border-radius);
  }
</style>
