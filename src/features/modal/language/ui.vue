<template>
  <ConsoleModal
    v-model="configStore.config.language"
    search-key="name"
    :items="langList"
    :active-item="configStore.config.language"
    @item-selected="changeLang"
  >
    <template #items="{ filteredItems, focusedItems, selectItem }">
      <div
        v-for="(lang, index) in filteredItems"
        :key="index"
        class="lang"
        :class="{
          active: lang == configStore.config.language,
          focused: index === focusedItems
        }"
        @click="selectItem(lang)"
      >
        {{ lang.replace('_', ' ') }}
      </div>
    </template>
  </ConsoleModal>
</template>

<script lang="ts" setup>
import { inject, Ref } from 'vue'
import { ConsoleModal } from '../console'
import { useConfigStore } from '@/entities/config/model/store'
const configStore = useConfigStore()
const langList = inject<Ref<string[]>>('lang')

const changeLang = async (lang: string) => {
  await configStore.setLanguage(lang)
}
</script>

<style lang="scss" scoped>
.focused {
  border: 2px solid var(--main-color);
}

.active {
  background-color: var(--sub-color);
}

.lang {
  cursor: pointer;
  display: flex;
  padding: 4px 20px;
  color: var(--text-color);
}
</style>
