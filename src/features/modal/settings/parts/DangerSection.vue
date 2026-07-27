<template>
  <div class="settings-section">
    <SettingRow id="data">
      <Button color="gray" size="s" @click="exportSettings">
        {{ t('settings.data.export') }}
      </Button>
      <Button color="gray" size="s" @click="pickFile">{{ t('settings.data.import') }}</Button>
      <input
        ref="fileRef"
        class="danger__file"
        type="file"
        accept="application/json"
        @change="onFile"
      />
    </SettingRow>

    <SettingRow id="reset">
      <template v-if="confirmingReset">
        <Button color="error" size="s" @click="resetSettings">
          {{ t('settings.reset.confirm') }}
        </Button>
        <Button color="gray" size="s" @click="confirmingReset = false">
          {{ t('settings.reset.cancel') }}
        </Button>
      </template>
      <Button v-else color="error-outline" size="s" @click="confirmingReset = true">
        {{ t('settings.reset.action') }}
      </Button>
    </SettingRow>

    <SettingRow id="cookies">
      <Button color="main-outline" size="s" @click="nav?.openCookies()">
        {{ t('settings.cookies.open') }}
      </Button>
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { inject, ref, useTemplateRef } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config/model/store'
  import { SETTINGS_NAV } from '../model/registry'
  import defaultConfig from '@/shared/constants/default-config'
  import type { Config } from '@/shared/constants/type'
  import { Button } from '@/shared/ui/button'
  import { toast } from '@/shared/ui/sonner'
  import SettingRow from './SettingRow.vue'

  /**
   * Import/export of the whole config. Import goes through `setConfig`, so an
   * edited or stale file can never poison the store: unknown keys are ignored
   * and invalid values are rejected per field by the same validators the UI
   * uses. Font and size need their setters (they also paint CSS variables).
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  const nav = inject(SETTINGS_NAV, undefined)
  const fileRef = useTemplateRef<HTMLInputElement>('fileRef')
  // Two-step: the button turns into its own confirmation rather than raising a
  // second dialog over the settings one.
  const confirmingReset = ref(false)

  const resetSettings = async (): Promise<void> => {
    confirmingReset.value = false
    await configStore.resetSettings()
    toast.success(t('settings.reset.done'))
  }

  const exportSettings = (): void => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'typemore-settings.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pickFile = (): void => fileRef.value?.click()

  const onFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      parsed = null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast.error(t('settings.data.importFailed'))
      return
    }

    const incoming = parsed as Partial<Config>
    let applied = 0
    for (const key of Object.keys(defaultConfig) as (keyof Config)[]) {
      const value = incoming[key]
      if (value === undefined) continue
      if (key === 'fontFamily' && typeof value === 'string') {
        configStore.setFontFamily(value)
        applied += 1
        continue
      }
      if (key === 'fontSize' && typeof value === 'number') {
        configStore.setFontSize(value)
        applied += 1
        continue
      }
      if (key === 'theme' && typeof value === 'string') {
        void configStore.setTheme(value)
        applied += 1
        continue
      }
      if (configStore.setConfig(key, value as Config[typeof key])) applied += 1
    }

    if (applied === 0) {
      toast.error(t('settings.data.importFailed'))
      return
    }
    toast.success(t('settings.data.imported'))
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }

  .danger__file {
    display: none;
  }
</style>
