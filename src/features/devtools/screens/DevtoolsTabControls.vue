<template>
  <p class="stat-line">
    <span>FPS</span>
    <ToggleButton
      size="s"
      value="showFps"
      v-model="configStore.config.showFps"
      @update:modelValue="configStore.setFPS"
      label="Devtools change"
      toggledColor="main"
      color="shadow"
    >
      {{ configStore.config.showFps ? 'OFF' : 'ON' }}
    </ToggleButton>
  </p>

  <p class="stat-line">
    <span>Keyboard</span>
    <ToggleButton
      size="s"
      value="showKeyboard"
      label="toggle visibility keyboard"
      toggled-color="main"
      color="shadow"
      v-model="configStore.config.showKeyboard"
    >
      {{ configStore.config.showKeyboard ? 'OFF' : 'ON' }}
    </ToggleButton>
  </p>
  <p class="stat-line">
    <span>Play sound</span>
    <ToggleButton
      size="s"
      value="playSound"
      v-model="configStore.config.playSound"
      label="Devtools change"
      toggledColor="main"
      color="shadow"
    >
      {{ configStore.config.playSound ? 'OFF' : 'ON' }}
    </ToggleButton>
  </p>
  <p class="stat-line">
    <span>Modes</span>
  </p>
  <ToggleGroup v-model="configStore.config.mode" @change="configStore.setMode">
    <ToggleButton label="Word mod" color="shadow" value="words" toggledColor="main">
      <template #left-icon>
        <Icon width="20" icon="mynaui:letter-a-solid" />
      </template>
    </ToggleButton>
    <ToggleButton label="Time mod" color="shadow" value="time" toggledColor="main">
      <template #left-icon>
        <Icon width="20" icon="mingcute:time-fill" />
      </template>
    </ToggleButton>
    <ToggleButton label="Free mod" color="shadow" value="free" toggledColor="main">
      <template #left-icon>
        <Icon width="20" icon="ic:round-crop-free" />
      </template>
    </ToggleButton>
  </ToggleGroup>

  <p class="stat-line">
    <span>Url</span>
    <TextInput size="xs" color="gray" />
    <Button size="s">asd</Button>
  </p>
</template>

<script lang="ts" setup>
  import { ToggleButton } from '@/shared/ui/toggleButton'
  import { useConfigStore } from '@/entities/config/model/store'
  import { ToggleGroup } from '@/shared/ui/toggleGroup'
  import { Icon } from '@iconify/vue'
  import { TextInput } from '@/shared/ui/input'
  import { Button } from '@/shared/ui/button'

  const configStore = useConfigStore()
</script>
<style lang="scss" scoped>
  .stat-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
    font-size: 14px;

    span {
      &:first-child {
        font-size: 16px;
      }
    }
  }
</style>
