<template>
    <ConsoleModal @item-selected="changeLang" v-model="selectedLang" search-key="name" :items="langList"
        :active-item="selectedLang">
        <template #items="{ filteredItems, focusedItems, selectItems }">
            <div class="lang" v-for="(lang, index) in filteredItems" :key="index" :class="{
                active: lang == selectedLang,
                focused: index === focusedItems
            }" @click="selectItems(lang)">
                {{ lang.replace("_", ' ') }}
            </div>
        </template>
    </ConsoleModal>
</template>

<script lang="ts" setup>
import { inject, Ref, ref } from 'vue'
import { ConsoleModal } from '../console'
import { useConfigStore } from '@/entities/config/store';
const configStore = useConfigStore()
const langList = inject<Ref<string[]>>('lang')
const selectedLang = ref(langList?.value.find((lang) => lang === configStore.config.language) || null)
const changeLang = async (lang: string) => {
    await configStore.setLanguage(lang)
    selectedLang.value = lang
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
