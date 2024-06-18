<template>
    <ConsoleModal @item-selected="changeLang" v-model="configStore.config.language" search-key="name" :items="langList"
        :active-item="configStore.config.language">
        <template #items="{ filteredItems, focusedItems, selectItems }">
            <div class="lang"   v-for="(lang, index) in filteredItems" :key="index" :class="{
                active: lang == configStore.config.language,
                focused: index === focusedItems
            }" @click="selectItems(lang)">
                {{ lang.replace("_", ' ') }}
            </div>
        </template>
    </ConsoleModal>
</template>

<script lang="ts" setup>
import { inject, Ref } from 'vue'
import { ConsoleModal } from '../console'
import { useConfigStore } from '@/entities/config/store';
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
