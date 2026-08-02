<template>
  <div class="settings-section">
    <SettingRow id="soundVolume">
      <Slider
        class="min-w-0 flex-1"
        :model-value="[config.soundVolume]"
        :min="0"
        :max="1"
        :step="0.05"
        :aria-label="t('settings.soundVolume.label')"
        @update:model-value="onVolume"
      />
      <Typography
        size="xs"
        color="sub"
        tag-name="span"
        class="w-10 shrink-0 text-right tabular-nums"
      >
        {{ volumePercent }}
      </Typography>
    </SettingRow>

    <SettingRow id="soundOnClick">
      <SettingSelect
        :model-value="activePack"
        :options="packOptions"
        :label="t('settings.soundOnClick.label')"
        @update="onPack"
      />
    </SettingRow>

    <!-- Only once something is audible at all: an error-sample picker under a
         muted keyboard is a control with nothing behind it. -->
    <SettingRow v-if="config.playSound" id="soundOnError">
      <SettingSelect
        :model-value="config.errorSoundSet"
        :options="errorOptions"
        :label="t('settings.soundOnError.label')"
        @update="onErrorPack"
      />
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useConfigStore } from '@/entities/config'
  import { ERROR_SOUND_PACKS, SOUND_PACKS } from '@/shared/constants/sound-packs'
  import { Slider } from '@/shared/ui/slider'
  import { Typography } from '@/shared/ui/typography'
  import SettingRow from './SettingRow.vue'
  import SettingSelect, { type SettingOption } from './SettingSelect.vue'

  /**
   * `playSound` + `soundSet` are one decision for the player ("what do I hear on
   * a keystroke"), so they are one control: picking `off` mutes, picking a pack
   * both selects and unmutes.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config

  const volumePercent = computed(() => `${Math.round(config.soundVolume * 100)}%`)
  const activePack = computed(() => (config.playSound ? config.soundSet : 'off'))

  const packOptions = computed<SettingOption[]>(() => [
    { value: 'off', label: t('settings.value.off') },
    ...SOUND_PACKS.map((pack) => ({ value: pack.id, label: pack.label }))
  ])

  const errorOptions = computed<SettingOption[]>(() =>
    ERROR_SOUND_PACKS.map((pack) => ({ value: pack.id, label: pack.label }))
  )

  const onVolume = (value: number[] | undefined): void => {
    const next = value?.[0]
    if (next !== undefined) configStore.setConfig('soundVolume', next)
  }

  const onPack = (value: unknown): void => {
    if (typeof value !== 'string') return
    if (value === 'off') {
      configStore.setConfig('playSound', false)
      return
    }
    configStore.setConfig('soundSet', value)
    configStore.setConfig('playSound', true)
  }

  const onErrorPack = (value: unknown): void => {
    if (typeof value === 'string') configStore.setConfig('errorSoundSet', value)
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
