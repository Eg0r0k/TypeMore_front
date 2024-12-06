<template>
  <div class="devtools" :style="style">
    <div ref="devtoolsRef" class="devtools__head">
      <div class="dot--group" @click="toggleDevtools">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
    <Transition name="accordion">
      <DevtoolsTabs v-if="isOpen" :tabs="tabs" />
    </Transition>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'

  import { DevtoolsTabs } from '@/features/devtools/tabs'

  import { useDraggable } from '@vueuse/core'

  const isOpen = ref(true)
  const tabs = [
    { name: 'stats', label: 'Info' },
    { name: 'test-info', label: 'Controls' }
  ]

  const toggleDevtools = () => {
    isOpen.value = !isOpen.value
  }

  const devtoolsRef = ref<HTMLElement | null>(null)
  const { x, y, style } = useDraggable(devtoolsRef, {
    onMove: ({ x: newX, y: newY }) => {
      if (devtoolsRef.value) {
        const maxX = window.innerWidth - devtoolsRef.value.offsetWidth
        const maxY = window.innerHeight - devtoolsRef.value.offsetHeight
        x.value = Math.max(0, Math.min(newX, maxX))
        y.value = Math.max(0, Math.min(newY, maxY))
      }
    }
  })
</script>

<style lang="scss" scoped>
  .accordion-enter-active,
  .accordion-leave-active {
    transition:
      max-height 0.3s ease,
      opacity 0.5s ease;
  }

  .accordion-enter-from,
  .accordion-leave-to {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    overflow: hidden;
    opacity: 0;
  }

  .accordion-enter-to,
  .accordion-leave-from {
    max-height: 1080px;
    opacity: 1;
  }

  .accordion-content {
    padding: 0 0 10px;
    transition: opacity 0.3s ease;
  }

  .accordion-enter-active .accordion-content {
    opacity: 1;
    transition-delay: 0.3s;
  }

  .devtools {
    position: fixed;
    z-index: var(--fps-z);
    min-width: 300px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    outline: 2px solid var(--sub-color);

    &__head {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 11px 20px;
      touch-action: none;
      cursor: grab;
    }

    &__body {
      padding: 0 20px;
      overflow: hidden;
    }
  }

  .dot {
    width: 4px;
    height: 4px;
    aspect-ratio: 1/1;
    user-select: none;
    background-color: var(--main-color);
    border-radius: 100%;

    &--group {
      display: grid;
      grid-template-rows: repeat(2, 1fr);
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 2px;
    }
  }
</style>
