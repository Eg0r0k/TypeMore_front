<template>
    <div class="theme-modal" @keydown.tab.prevent="navigateThemes('down')" @keydown.up.prevent="navigateThemes('up')"
        @keydown.down.prevent="navigateThemes('down')" @keydown.enter.prevent="selectFocusedTheme" tabindex="0">
        <div class="theme-modal__header modal-header">
            <div class="modal-header__icon">
                <Icon width="20" icon="fluent:search-12-filled" />
            </div>
            <input ref="searchInput" type="text" v-model.trim="searchQuery" class="modal-header__search"
                placeholder="Search...">
        </div>

        <div role="listbox" ref="themeModalBody" class="theme-modal__body">
            <div :aria-selected="theme.name === config.theme" role="option" class="theme" @click="changeTheme(theme)"
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
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref, watch, nextTick, inject, Ref } from 'vue';
import { Typography } from '@/shared/ui/typography';
import { useConfigStore } from '@/entities/config/store';
import { useFocus } from '@vueuse/core';
import { Theme } from './types/themes';
import { applyTheme } from '@/shared/lib/hooks/useThemes';

const { config } = useConfigStore();

const selectedTheme = ref(config.theme);
const themesList = inject<Ref<Theme[]>>('themes');
const searchQuery = ref('');
const focusedThemeIndex = ref(-1);
const searchInput = ref<HTMLInputElement | null>(null);
const themeModalBody = ref<HTMLElement | null>(null);

const filteredThemes = computed(() =>
    themesList!.value.filter(theme =>
        theme.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
);

watch(filteredThemes, (newThemes) => {
    if (focusedThemeIndex.value >= newThemes.length) {
        focusedThemeIndex.value = -1;
    }
});

// Function to change the theme
const changeTheme = async (theme: Theme): Promise<void> => {
    await applyTheme(theme.name);
    selectedTheme.value = theme.name;
};

const navigateThemes = async (direction: 'up' | 'down') => {
    const themesLength = filteredThemes.value.length;
    if (themesLength === 0) return;
    focusedThemeIndex.value = (focusedThemeIndex.value + (direction === 'up' ? -1 : 1) + themesLength) % themesLength;
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
    nextTick(() => {
        if (!themeModalBody.value || !selectedTheme.value) return;
        const activeIndex = filteredThemes.value.findIndex(theme => theme.name === selectedTheme.value);
        if (activeIndex >= 0) {
            focusedThemeIndex.value = activeIndex;
            centerFocusedTheme();
        }
    });
};

useFocus(searchInput, { initialValue: true });

onMounted(async () => {
    centerActiveTheme();
});
</script>
<style lang="scss" scoped>
.modal-header {

    display: flex;
    align-items: center;

    &__icon {
        color: var(--sub-color);
        margin: 5px 1rem 0;
    }

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
        padding: 10px 20px 10px 0;
        font-size: 16px;
        color: var(--text-color);
        caret-color: var(--main-color);
        position: relative;
    }

}

.theme-modal {
    border-radius: var(--border-radius);
    outline: 3px solid var(--sub-color);
    max-width: 700px;
    overflow: hidden;
    width: 100%;
    max-height: 100%;
    background-color: var(--sub-alt-color);




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
