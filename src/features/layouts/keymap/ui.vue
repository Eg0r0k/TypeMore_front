<template>
  <div :style="style" ref="el" class="key-map">
    <div v-for="row in keys" :key="row.id" class="key-map__row">
      <div v-for="key in row.keys" :key="key.code" class="key-map__key key" :class="{ active: pressedKeys[key.code] }">
        <b>{{ getLabel(key) }}</b>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDraggable } from '@vueuse/core';
import { onMounted, onUnmounted, reactive, ref } from 'vue'
const el = ref<HTMLElement | null>(null)

const { x, y, style } = useDraggable(el, {
  initialValue: { x: (window.innerWidth - 650) / 2, y: (window.innerHeight + 55) / 2 },
  onMove: ({ x: newX, y: newY, }) => {
    const maxX = window.innerWidth - el.value!.offsetWidth;
    const maxY = window.innerHeight - el.value!.offsetHeight;
    x.value = Math.max(0, Math.min(newX, maxX));
    y.value = Math.max(0, Math.min(newY, maxY));
  },
});


//Keys to show
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
      { code: 'BracketLeft', label: "[" },
      { code: 'BracketRight', label: ']' }
    ]
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
      { code: 'Semicolon', label: ';' },
      { code: 'Quote', label: "\\" }
    ]
  },
  {
    id: 3,
    keys: [
      // { code: 'ShiftLeft', label: 'L Shift' },
      { code: 'KeyZ', label: 'z' },
      { code: 'KeyX', label: 'x' },
      { code: 'KeyC', label: 'c' },
      { code: 'KeyV', label: 'v' },
      { code: 'KeyB', label: 'b' },
      { code: 'KeyN', label: 'n' },
      { code: 'KeyM', label: 'm' },
      { code: 'Comma', label: ',' },
      { code: 'Period', label: '.' },
      { code: 'Slash', label: "/" }
    ]
  },
  {
    id: 4,
    keys: [

      { code: 'Space', label: 'Space' }
    ]
  }
]


//Object to contain keys
const pressedKeys = reactive<Record<string, boolean>>({})
//Handle keyDown
const handleKeyDown = (event: KeyboardEvent): void => {
  pressedKeys[event.code] = true
}
//Handle keyUp
const handleKeyUp = (event: KeyboardEvent): void => {
  pressedKeys[event.code] = false
}
//If shift is down UpperCase labels in keys
const getLabel = (key: { code: string; label: string }): string => {
  return pressedKeys['ShiftLeft'] || pressedKeys['ShiftRight'] ? key.label.toUpperCase() : key.label
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<style lang="scss" scoped>
.key-map {
  z-index: var(--key-map-z);
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  z-index: 100;
  position: fixed;
  touch-action: none;

  &__row {
    display: flex;
    gap: 10px;
  }
}

.key-map__row:last-child {
  display: block;

  & div {
    width: 240px;
  }
}

.key {
  user-select: none;
  min-width: 45px;
  min-height: 45px;
  transition: all 0.1s;
  padding: 10px;
  border-radius: 5px;
  color: var(--main-color);
  text-align: center;
  background-color: var(--sub-alt-color);
  &.active {
    background-color: var(--sub-color);
  }
}
</style>
