<template>
  <div ref="mapRef" :style="style" class="key-map" aria-label="Virtual key map">
    <div v-for="row in KEYS" :key="row.id" class="key-map__row">
      <div
        v-for="key in row.keys"
        :key="key.code"
        :class="['key-map__key key', pressedKeys[key.code] ? 'active' : '']"
      >
        <kbd>
          <b>{{ getLabel(key) }}</b>
        </kbd>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { useDraggable } from '@vueuse/core'
  import { onMounted, onUnmounted, reactive, ref } from 'vue'
  import { KEYS } from './const/keys'
  const mapRef = ref<HTMLElement | null>(null)

  const { x, y, style } = useDraggable(mapRef, {
    initialValue: { x: (window.innerWidth - 600) / 2, y: (window.innerHeight + 55) / 2 },
    onMove: ({ x: newX, y: newY }) => {
      if (!mapRef.value) return
      const maxX = window.innerWidth - mapRef.value!.offsetWidth
      const maxY = window.innerHeight - mapRef.value!.offsetHeight
      x.value = Math.max(0, Math.min(newX, maxX))
      y.value = Math.max(0, Math.min(newY, maxY))
    }
  })

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
    return pressedKeys['ShiftLeft'] || pressedKeys['ShiftRight']
      ? key.label.toUpperCase()
      : key.label
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
    border-bottom: 1px solid var(--main-color);
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    min-width: 40px;
    min-height: 40px;
    transition: all 0.1s;
    padding: 10px;
    border-radius: 5px;
    color: var(--main-color);
    text-align: center;
    background-color: var(--sub-alt-color);

    &.active {
      background-color: var(--sub-color);
      border-bottom: 1px solid transparent;
    }
  }
</style>
