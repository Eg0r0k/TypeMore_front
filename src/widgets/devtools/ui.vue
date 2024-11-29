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
      <div class="devtools__body" v-show="isOpen">
        <div class="accordion-content">
          <DevtoolsLabel>
            <template #label>Test Info</template>
            <p class="stat-line">
              <span>Timer:</span>
              <span>{{ configStore.config.time - timerStore.time }}</span>
            </p>
            <p class="stat-line">
              <span>State:</span>
              <span>{{ testState.isActive }}</span>
            </p>
            <p class="stat-line">
              <span>Words:</span>
              <span>{{ testState.currentWordElementIndex }}/{{ configStore.config.words }}</span>
            </p>
          </DevtoolsLabel>

          <DevtoolsLabel>
            <template #label>Stats</template>

            <p class="stat-line">
              <span>WPM:</span>
              <span>{{ getStats.wpm }}</span>
            </p>
            <p class="stat-line">
              <span>Raw WPM:</span>
              <span>{{ getStats.wpmRaw }}</span>
            </p>
            <p class="stat-line">
              <span>Correct Chars:</span>
              <span>{{ getStats.correctChars }}</span>
            </p>
            <p class="stat-line">
              <span>Inorrect Chars:</span>
              <span>{{ getStats.incorrectChars }}</span>
            </p>
            <p class="stat-line">
              <span>Missed Chars:</span>
              <span>{{ getStats.missedChars }}</span>
            </p>
            <p class="stat-line">
              <span>Extra Chars:</span>
              <span>{{ getStats.extraChars }}</span>
            </p>
            <p class="stat-line">
              <span>Spaces:</span>
              <span>{{ getStats.correctSpaces }}/{{ getStats.spaces }}</span>
            </p>
          </DevtoolsLabel>

          <DevtoolsLabel>
            <template #label>Accuracy</template>

            <p class="stat-line">
              <span>Accuracy:</span>
              <span>{{ inputStore.accuracyPercentage }}%</span>
            </p>
            <p class="stat-line">
              <span>Correct:</span>
              <span>{{ inputStore.accuracy.correct }}</span>
            </p>
            <p class="stat-line">
              <span>Incorrect:</span>
              <span>{{ inputStore.accuracy.incorrect }}</span>
            </p>
          </DevtoolsLabel>

          <DevtoolsLabel>
            <template #label>Inputs</template>
            <small>Histroy: {{ inputStore.input.history }}</small>
            <br />
            <small>Miss: {{ inputStore.missedWords }}</small>
          </DevtoolsLabel>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
  import { useConfigStore } from '@/entities/config/model/store'
  import { useInputStore } from '@/entities/input'
  import { useTestStateStore } from '@/entities/test'
  import { useTimerStore } from '@/entities/timer/model/store'
  import { DevtoolsLabel } from '@/features/devtools/label'
  import { useStats } from '@/shared/lib/hooks/useStats'
  import { useDraggable } from '@vueuse/core'
  import { ref } from 'vue'

  const { getStats } = useStats()
  const inputStore = useInputStore()
  const testState = useTestStateStore()
  const configStore = useConfigStore()
  const timerStore = useTimerStore()
  const isOpen = ref(true)
  const toggleDevtools = () => {
    isOpen.value = !isOpen.value
  }

  const openInput = ref(false)

  const devtoolsRef = ref<HTMLElement | null>(null)
  const { x, y, style } = useDraggable(devtoolsRef, {
    onMove: ({ x: newX, y: newY }) => {
      if (devtoolsRef.value) {
        const maxX = window.innerWidth - devtoolsRef.value!.offsetWidth
        const maxY = window.innerHeight - devtoolsRef.value!.offsetHeight
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
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
    overflow: hidden;
  }

  .accordion-enter-to,
  .accordion-leave-from {
    max-height: 1080px;

    opacity: 1;
  }

  .accordion-content {
    transition: opacity 0.3s ease;
  }

  .accordion-enter-active .accordion-content {
    opacity: 1;
    transition-delay: 0.3s;
  }

  .accordion-content {
    padding: 0 0 10px 0;
  }

  .stat-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 5px 0;
    font-size: 14px;

    span {
      &:first-child {
        font-size: 16px;
      }
    }
  }

  .content {
    margin-bottom: 4px;

    &__label {
      position: relative;
      font-weight: 600 !important;

      &::after {
        content: '';
        position: absolute;
        height: 1px;
        background-color: var(--sub-color);
        top: 50%;
        transform: translateY(-50%);
        width: 100%;
      }
    }
  }

  .devtools {
    outline: 2px solid var(--sub-color);
    min-width: 300px;
    position: fixed;
    z-index: var(--fps-z);
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__head {
      touch-action: none;
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      cursor: grab;
      padding: 11px 20px 11px 20px;
    }

    &__body {
      padding: 0 20px 0 20px;
      overflow: hidden;
    }
  }

  .dot {
    user-select: none;
    width: 4px;
    height: 4px;
    aspect-ratio: 1/1;
    background-color: var(--main-color);
    border-radius: 100%;

    &--group {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 4px;
      padding: 2px;
    }
  }
</style>
