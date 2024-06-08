<template>
    <div class="key-map">
        <div v-for="row in keys" :key="row.id" class="key-map__row">
            <div v-for="key in row.keys" :key="key.code" class="key-map__key key"
                :class="{ active: pressedKeys[key.code] }">
                {{ getLabel(key) }}
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, reactive } from 'vue';

const keys = [
    {
        id: 1,
        keys: [

            { code: 'KeyQ', label: 'q' },
            { code: 'KeyW', label: 'w' },
            { code: 'KeyE', label: 'e' },
            { code: 'KeyR', label: 'r' },
            { code: 'KeyT', label: 't' },
            { code: 'KeyY', label: 'y' },
            { code: 'KeyU', label: 'u' },
            { code: 'KeyI', label: 'i' },
            { code: 'KeyO', label: 'o' },
            { code: 'KeyP', label: 'p' },
        ],
    },
    {
        id: 2,
        keys: [
            { code: 'KeyA', label: 'a' },
            { code: 'KeyS', label: 's' },
            { code: 'KeyD', label: 'd' },
            { code: 'KeyF', label: 'f' },
            { code: 'KeyG', label: 'g' },
            { code: 'KeyH', label: 'h' },
            { code: 'KeyJ', label: 'j' },
            { code: 'KeyK', label: 'k' },
            { code: 'KeyL', label: 'l' },
        ],
    },
    {
        id: 3,
        keys: [
            { code: 'KeyZ', label: 'z' },
            { code: 'KeyX', label: 'x' },
            { code: 'KeyC', label: 'c' },
            { code: 'KeyV', label: 'v' },
            { code: 'KeyB', label: 'b' },
            { code: 'KeyN', label: 'n' },
            { code: 'KeyM', label: 'm' },
        ],
    },
    {
        id: 4,
        keys: [
            { code: "ShiftLeft", label: "L Shift" },
            { code: 'Space', label: "Space" },
        ]
    }
];
const pressedKeys = reactive<Record<string, boolean>>({});

const handleKeyDown = (event: KeyboardEvent) => {
    pressedKeys[event.code] = true;
};

const handleKeyUp = (event: KeyboardEvent) => {
    pressedKeys[event.code] = false;
};
const getLabel = (key: { code: string; label: string }) => {
    return pressedKeys['ShiftLeft'] || pressedKeys['ShiftRight']
        ? key.label.toUpperCase()
        : key.label;
};
onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
});
</script>

<style lang="scss" scoped>
.key-map {
    display: flex;
    flex-direction: column;
    gap: 5px;

    &__row {
        display: flex;
        gap: 5px;
    }
}


.key {
    min-width: 25px;
    min-height: 25px;
    transition: all 0.05s;
    padding: 10px;
    box-shadow: 0 0 0 1px var(--sub-color);
    border-radius: 5px;
    color: var(--text-color);
    text-align: center;

    &.active {
        box-shadow: 0 0 0 1.5px var(--main-color),
    }
}
</style>