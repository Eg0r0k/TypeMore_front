<template>
  <ConsoleModal v-model="configStore.config.theme" :items="themeList" search-key="name"
    :active-item="configStore.config.theme" @item-selected="changeTheme">
    <template #items="{ filteredItems, selectItems, focusedItems }">
      <div v-for="(theme, index) in filteredItems" :key="theme.name"
        :aria-selected="theme.name === configStore.config.theme" role="option" class="theme" @click="selectItems(theme)"
        :class="{
          active: theme.name === configStore.config.theme,
          focused: index === focusedItems
        }">
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


const configStore = useConfigStore()
const themeList = inject<Ref<Theme[]>>('themes')

const changeTheme = async (theme: Theme): Promise<void> => {

  await configStore.setTheme(theme.name)
}
</script>

<style lang="scss" scoped>
.active {
  background-color: var(--sub-color);
}

.focused {
  border: 2px solid var(--main-color);
}

.theme {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  padding: 4px 20px;
  color: var(--sub-color);

  &:hover {
    background-color: var(--sub-color);
  }

  &__icon {
    border-radius: var(--border-radius);
    padding: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__color {
    aspect-ratio: 1/1;
    width: 15px;
    border-radius: 50%;
  }
}
</style>
