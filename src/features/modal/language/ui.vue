<template>
    <ConsoleModal search-key="name" :items="langList">
        <template #items="{ filteredItems, focusedItems }">
            <div class="lang" v-for="(lang, index) in filteredItems" :key="index" :class="{
                focused: index === focusedItems
            }">
                {{ lang.replace("_", ' ') }}
            </div>
        </template>
    </ConsoleModal>
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { ConsoleModal } from '../console'

//TODO: fetch langs
const langList = inject<string[]>('lang')

</script>

<style lang="scss" scoped>
.focused {
    border: 2px solid var(--main-color);
}

.lang {
    cursor: pointer;
    display: flex;
    padding: 4px 20px;
    color: var(--text-color);
}
</style>
