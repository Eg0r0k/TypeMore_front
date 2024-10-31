<template>
    <div class="custom-select" :tabindex="tabindex" @blur="open = false" role="combobox" :aria-expanded="open"
        :aria-labelledby="labelId">
        <label :id="labelId" class="sr-only">{{ label }}</label>
        <div class="selected" :class="{ open }" @click="toggleDropdown" role="button" aria-haspopup="listbox">
            {{ selected }}
        </div>
        <div class="items" :class="{ selectHide: !open }" role="listbox">
            <div v-for="option in options" :key="option" @click="selectOption(option)"
                :aria-selected="selected === option">
                {{ option }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue';

interface Props {
    options: string[];
    default?: string | null;
    tabindex?: number;
    label: string;
}
function generateId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'input', value: string): void;
}>();
const labelId = generateId('custom-select');
const selected = ref(props.default || props.options[0] || null);
const open = ref(false);

watch(selected, (newValue: string | null) => {
    if (!newValue) return
    emit('input', newValue);
});

function toggleDropdown() {
    open.value = !open.value;
}

function selectOption(option: string) {
    selected.value = option;
    open.value = false;
}


</script>

<style lang="scss" scoped>
.custom-select {
    position: relative;
    width: 100%;
    text-align: left;
    outline: none;
    height: 31px;
    line-height: 31px;
    font-size: 13px;

    .selected {
        background-color: var(--sub-alt-color);
        border-radius: 6px;
        outline: 1px solid var(--sub-color);
        color: var(--text-color);
        padding-left: 8px;
        padding-right: 24px;

        cursor: pointer;
        user-select: none;
        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;


        &.open {
            outline: 1px solid var(--main-color);
            border-radius: 6px 6px 0 0;
        }

        &::after {
            position: absolute;
            content: '';
            top: 15px;
            right: 1em;
            width: 0;
            height: 0;
            border: 5px solid transparent;
            border-color: var(--text-color) transparent transparent transparent;
        }
    }

    .items {
        color: var(--text-color);
        border-radius: 0 0 6px 6px;
        overflow: hidden;
        outline: 1px solid var(--main-color);
        position: absolute;
        background-color: var(--sub-alt-color);
        left: 0;
        right: 0;
        z-index: 1;

        div {
            color: var(--text-color);
            padding-left: 8px;
            cursor: pointer;
            user-select: none;

            &:hover {
                background-color: var(--sub-color);
            }
        }
    }

    .selectHide {
        display: none;
    }
}

.sr-only {
    @include hide-visually;
}
</style>