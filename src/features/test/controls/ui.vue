<template>
  <div class="controls">
    <div class="controls__presets">
      <div class="preset-group">
        <Button
          v-for="mode in modes"
          :key="mode"
          color="shadow"
          size="s"
          :class="{ active: configStore.config.mode === mode }"
          @click="handleModeChange(mode)"
        >
          {{ mode }}
        </Button>
      </div>
      <div class="preset-group">
        <Button
          v-for="preset in timePresets"
          :key="preset"
          color="shadow"
          size="s"
          :class="{
            active: configStore.config.mode === 'time' && configStore.config.time === preset
          }"
          @click="handleTimePreset(preset)"
        >
          {{ preset }}s
        </Button>
      </div>
      <div class="preset-group">
        <Button
          v-for="preset in wordPresets"
          :key="preset"
          color="shadow"
          size="s"
          :class="{
            active: configStore.config.mode === 'words' && configStore.config.words === preset
          }"
          @click="handleWordPreset(preset)"
        >
          {{ preset }}w
        </Button>
      </div>
      <Button size="s" color="shadow" @click="handleModalSettings">
        <template #left-icon>
          <Icon width="16" icon="fluent:settings-48-filled"></Icon>
        </template>
      </Button>
    </div>
    <Button color="main-outline" size="s" @click="handleOpenModalLang">
      <template #left-icon>
        <Icon width="24" icon="solar:globus-bold" />
      </template>
      {{ configStore.config.language }}
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { useConfigStore } from '@/entities/config/model/store'
  import { useModal } from '@/entities/modal/model/store'
  import { WordsModal } from '@/features/modal/words'
  import { LangModal } from '@/features/modal/language'
  import { Button } from '@/shared/ui/button'
  import { Icon } from '@iconify/vue'
  import { ConfigModes } from '@/shared/constants/type'
  import { TimeModal } from '@/features/modal/time'
  const handleModalSettings = () => {
    if (configStore.config.mode === ConfigModes.Words) {
      modal.open(WordsModal, 'center', 'center')
    } else {
      modal.open(TimeModal, 'center', 'center')
    }
  }
  const configStore = useConfigStore()
  const modal = useModal()
  const modes = ['words', 'free', 'time'] as const
  const timePresets = [10, 15, 30, 60]
  const wordPresets = [15, 30, 60, 120]

  const handleOpenModalLang = (): void => {
    modal.open(LangModal, 'top')
  }

  const handleModeChange = (mode: 'time' | 'words' | 'free') => {
    configStore.setMode(mode as ConfigModes)
  }

  const handleTimePreset = (time: number) => {
    configStore.setMode(ConfigModes.Time)
    configStore.config.time = time
  }

  const handleWordPreset = (words: number) => {
    configStore.setMode(ConfigModes.Words)
    configStore.config.words = words
  }
</script>

<style lang="scss" scoped>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    margin-bottom: 8px;

    &__presets {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      justify-content: center;
    }
  }

  .preset-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  :deep(.active) {
    p {
      color: var(--main-color);
    }
  }
</style>
