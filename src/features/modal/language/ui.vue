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
        role="option"
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
  import { LANG_KEY } from '@/shared/constants/inject-keys'
  const configStore = useConfigStore()
  const langList = inject<Ref<string[]>>(LANG_KEY) as Ref<string[]>

  const changeLang = async (lang: string) => {
    await configStore.setLanguage(lang)
  }
</script>

<style lang="scss" scoped>
  .focused {
    border: 2px solid var(--main-color);
  }

  .active {
    background-color: var(--sub-alt-color) !important;
  }

  .lang {
    display: flex;
    padding: 4px 20px;
    color: var(--text-color);
    cursor: pointer;
  }
</style>
