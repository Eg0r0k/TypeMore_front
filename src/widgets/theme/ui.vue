<template>
    <div class="theme-modal" @keydown.tab.prevent="navigateThemes('down')" @keydown.up.prevent="navigateThemes('up')"
        @keydown.down.prevent="navigateThemes('down')" @keydown.enter.prevent="selectFocusedTheme" tabindex="0">
        <div class="theme-modal__header">
            <input ref="searchInput" type="text" v-model.trim="searchQuery" class="theme-modal__search"
                placeholder="Search...">
        </div>
        <div ref="themeModalBody" class="theme-modal__body">
            <div class="theme" @click="changeTheme(theme)"
                :class="{ active: theme.name === selectedTheme, focused: index === focusedThemeIndex }"
                v-for="(theme, index) in filteredThemes" :key="theme.name">
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
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { Typography } from '@/shared/ui/typography';
import { useConfigStore } from '@/entities/config/store';
import { useFocus } from '@vueuse/core';

const { config } = useConfigStore();

type Theme = {
    name: string;
    '--bg-color': string;
    '--main-color': string;
    '--sub-color': string;
    '--sub-alt-color': string;
    '--text-color': string;
    '--error-color': string;
    '--error-extra-color': string;
};
const root: HTMLElement | null = document.querySelector(':root');
const selectedTheme = ref(config.theme);
const themesList = ref<Theme[]>([]);
const searchQuery = ref('');
const focusedThemeIndex = ref(-1);
const searchInput = ref<HTMLInputElement | null>(null);
const themeModalBody = ref<HTMLElement | null>(null);
async function fetchThemes() {
    if (themesList.value.length === 0) {
        const themes = await cachedFetchJson<Theme[]>('./static/themes/themes.json');
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
const filteredThemes = computed((): Theme[] => {
    return themesList.value.filter(theme =>
        theme.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});
watch(filteredThemes, (newThemes) => {
    if (focusedThemeIndex.value >= newThemes.length) {
        focusedThemeIndex.value = -1;
    }
});

//TODO: Move changeTheme, setVaribles 
const changeTheme = (theme: Theme): void => {
    selectedTheme.value = theme.name;
    setVariables(theme);
};
const setVariables = (theme: Theme): void => {
    Object.entries(theme).forEach(([key, value]) => {
        if (root) {
            root.style.setProperty(key, value as string);
        }
    });
};
const navigateThemes = async (direction: 'up' | 'down'): Promise<void> => {
    const themesLength = filteredThemes.value.length;
    if (themesLength === 0) return;
    if (direction === 'up') {
        focusedThemeIndex.value = focusedThemeIndex.value <= 0 ? themesLength - 1 : focusedThemeIndex.value - 1;
    } else {
        focusedThemeIndex.value = focusedThemeIndex.value >= themesLength - 1 ? 0 : focusedThemeIndex.value + 1;
    }

    nextTick(() => {
        centerFocusedTheme();
    });


};
const selectFocusedTheme = (): void => {
    if (focusedThemeIndex.value >= 0 && focusedThemeIndex.value < filteredThemes.value.length) {
        changeTheme(filteredThemes.value[focusedThemeIndex.value]);
    }
};
const centerFocusedTheme = () => {
    if (themeModalBody.value && focusedThemeIndex.value !== -1) {
        const focusedTheme = themeModalBody.value.children[focusedThemeIndex.value] as HTMLElement;
        const bodyHeight = themeModalBody.value.clientHeight - 240;
        const themeHeight = focusedTheme.clientHeight;
        const offset = (bodyHeight - themeHeight) / 1.1;
        themeModalBody.value.scrollTop = focusedTheme.offsetTop - offset;
    }
};
const centerActiveTheme = async (): Promise<void> => {
    await nextTick();

    if (themeModalBody.value && selectedTheme.value) {
        const activeIndex = filteredThemes.value.findIndex(theme => theme.name === selectedTheme.value);
        if (activeIndex >= 0) {
            focusedThemeIndex.value = activeIndex;
            centerFocusedTheme();
        }
    }
};
useFocus(searchInput, { initialValue: true })
onMounted(async () => {
    await fetchThemes();
    centerActiveTheme();
});
</script>
<style lang="scss" scoped>
.theme-modal {
    border-radius: var(--border-radius);
    outline: 3px solid var(--sub-color);
    max-width: 700px;
    overflow: hidden;
    width: 100%;
    max-height: 100%;
    background-color: var(--sub-alt-color);

    &__search {
        &::placeholder {
            color: var(--sub-color);
            opacity: 1;
        }

        width: 100%;
        user-select: none;
        line-height: normal;
        box-sizing: border-box;
        background-color: var(--sub-alt-color);
        border-radius: var(--border-radius);
        border: none;
        outline: none;
        padding: 10px 20px;
        font-size: 16px;
        color: var(--text-color);
        caret-color: var(--main-color);
        position: relative;
    }

    &__body {
        overflow-y: scroll;
        max-height: calc(100vh - 200px);
        display: grid;
        cursor: pointer;
        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
    }
}

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
