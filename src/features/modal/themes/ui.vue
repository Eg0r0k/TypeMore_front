<template>
  <ConsoleModal
    v-model:open="open"
    :model-value="configStore.config.theme"
    :items="themeList"
    search-key="name"
    title="Themes"
    description="Search and select a color theme."
    @update:model-value="changeTheme"
  >
    <template #item="{ item }">
      <Typography color="primary">{{ item.name }}</Typography>
      <div class="theme__icon" :style="{ backgroundColor: item['--bg-color'] }">
        <div class="theme__color" :style="{ backgroundColor: item['--main-color'] }"></div>
        <div class="theme__color" :style="{ backgroundColor: item['--sub-color'] }"></div>
        <div class="theme__color" :style="{ backgroundColor: item['--text-color'] }"></div>
      </div>
    </template>
  </ConsoleModal>
</template>

<script lang="ts" setup>
  import { inject, type Ref } from 'vue'
  import { ConsoleModal } from '../console'
  import type { Theme } from '@shared/api'
  import { Typography } from '@/shared/ui/typography'
  import { useConfigStore } from '@/entities/config/model/store'
  import { THEMES_KEY } from '@/shared/constants/inject-keys'

  const open = defineModel<boolean>('open', { required: true })

  const configStore = useConfigStore()
  const themeList = inject(THEMES_KEY) as Ref<Theme[]>

  const changeTheme = async (name: string | string[] | null): Promise<void> => {
    if (typeof name === 'string') await configStore.setTheme(name)
  }
</script>
<style lang="scss" scoped>
  .theme {
    &__icon {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 4px;
      border-radius: var(--border-radius);
    }

    &__color {
      width: 15px;
      aspect-ratio: 1/1;
      border-radius: 50%;
    }
  }
</style>
