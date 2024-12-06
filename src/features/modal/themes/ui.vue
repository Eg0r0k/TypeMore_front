<template>
  <ConsoleModal
    :model="configStore.config.theme"
    :items="themeList"
    search-key="name"
    :active-item="configStore.config.theme"
    @item-selected="changeTheme"
  >
    <template #items="{ filteredItems, selectItem, focusedItems }">
      <div
        v-for="(theme, index) in filteredItems"
        :key="theme.name"
        :aria-selected="theme.name === configStore.config.theme"
        role="option"
        class="theme"
        :class="{
          active: theme.name === configStore.config.theme,
          focused: index === focusedItems
        }"
        @click="selectItem(theme)"
      >
        <div class="theme__name">
          <Typography color="primary">{{ theme.name }}</Typography>
        </div>
        <div class="theme__icon" :style="{ backgroundColor: theme['--bg-color'] }">
          <div class="theme__color" :style="{ backgroundColor: theme['--main-color'] }"></div>
          <div class="theme__color" :style="{ backgroundColor: theme['--sub-color'] }"></div>
          <div class="theme__color" :style="{ backgroundColor: theme['--text-color'] }"></div>
        </div>
      </div>
    </template>
  </ConsoleModal>
</template>

<script lang="ts" setup>
  import { inject, Ref } from 'vue'
  import { ConsoleModal } from '../console'
  import { Theme } from './types/themes'
  import { Typography } from '@/shared/ui/typography'
  import { useConfigStore } from '@/entities/config/model/store'
  import { THEMES_KEY } from '@/shared/constants/inject-keys'

  const configStore = useConfigStore()
  const themeList = inject<Ref<Theme[]>>(THEMES_KEY) as Ref<Theme[]>

  const changeTheme = async (theme: Theme): Promise<void> => {
    await configStore.setTheme(theme.name)
  }
</script>
<style lang="scss" scoped>
  .active {
    background-color: var(--sub-alt-color) !important;
  }

  .focused {
    border: 2px solid var(--main-color);
  }

  .theme {
    display: flex;
    justify-content: space-between;
    padding: 4px 20px;
    color: var(--sub-color);
    cursor: pointer;

    &:hover {
      background-color: var(--sub-color);
    }

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
