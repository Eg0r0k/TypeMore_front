<template>
    <div class="theme-modal">
        <div class="theme-modal__header">
            <input type="text" v-model="searchQuery" class="theme-modal__search">
        </div>
        <div class="theme-modal__body">
            <div class="theme" v-for="theme in filteredThemes" :key="theme.name">
                <div class="theme__name">
                    <Typography color="primary"> {{ theme.name }}</Typography>
                </div>
                <div class="theme__icon" :style="{ backgroundColor: theme['--bg-color'] }">
                    <div class="theme__color" :style="{ backgroundColor: theme['--main-color'] }"></div>
                    <div class="theme__color" :style="{ backgroundColor: theme['--sub-color'] }"></div>
                    <div class="theme__color" :style="{ backgroundColor: theme['--text-color'] }"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">

import { cachedFetchJson } from '@/shared/lib/helpers/json-files';
import { computed, onMounted, ref } from 'vue';
import { Typography } from '@/shared/ui/typography';

type Theme = {
    name: string
    '--bg-color': string
    '--main-color': string
    '--sub-color': string
    '--sub-alt-color': string
    '--text-color': string
    '--error-color': string
    '--error-extra-color': string
}
const themesList = ref<Theme[]>([])
const searchQuery = ref('');
async function fetchThemes() {
    if (themesList.value.length === 0) {
        const themes = await cachedFetchJson<Theme[]>('./src/static/themes/themes.json');
        const sortedThemes = themes.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        themesList.value = sortedThemes;
    }
}
const filteredThemes = computed(() => {
    return themesList.value.filter(theme =>
        theme.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});
onMounted(() => {
    fetchThemes();
});
</script>

<style lang="scss" scoped>
.theme-modal {
    border-radius: var(--border-radius);
    outline: 3px solid var(--sub-alt-color);
    max-width: 700px;
    overflow: hidden;

    &__search {
        width: 100%;
        user-select: none;
        width: 100%;
        line-height: normal;
        box-sizing: border-box;
        background-color: var(--sub-color);
        border-radius: var(--border-radius);
        border: none;
        outline: none;
        padding: 8px;
        font-size: 16px;
        color: var(--text-color);
        caret-color: var(--main-color);
        position: relative;
    }

    &__body {
        max-height: calc(100vh - 400px);
        overflow-y: scroll;
    }
}

.theme {
    cursor: pointer;
    display: flex;
    justify-content: space-between;

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