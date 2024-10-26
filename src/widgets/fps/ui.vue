<template>
  <div class="fps" role="status" aria-live="polite" :aria-label="`Fps counter ${fps}`">
    <dl>
      <dt>FPS:</dt>
      <dd>{{ fps }}</dd>
      <dt>AVG:</dt>
      <dd>{{ avgFps }}</dd>
      <dt>MAX:</dt>
      <dd>{{ maxFps }}</dd>
      <dt>MIN:</dt>
      <dd>{{ minFps }}</dd>
    </dl>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div>
        <p color="primary">Timer:{{ configStore.config.time - timerStore.time }}</p>
        <p color="primary">State:{{ testState.isActive }}</p>
        <p color="primary">
          Words: {{ testState.currentWordElementIndex }}/{{ configStore.config.words }}
        </p>
      </div>
      <div class="character-stats">
        <p>WPM: {{ getStats.wpm }}</p>
        <p>Raw WPM: {{ getStats.wpmRaw }}</p>
        <p>Correct Chars: {{ getStats.correctChars }}</p>
        <p>Missed Chars: {{ getStats.missedChars }}</p>
        <p>Extra Chars: {{ getStats.extraChars }}</p>
        <p>Spaces: {{ getStats.spaces }}</p>
      </div>
      <div>
        <p>Correct: {{ inputStore.accuracy.correct }}</p>
        <p>Incorrect: {{ inputStore.accuracy.incorrect }}</p>
        <p>Accuracy {{ inputStore.accuracyPercentage }}%</p>
      </div>
      <div style="max-width: 200px">
        <small>Histroy: {{ inputStore.input.history }}</small>
        <!-- <small>Miss: {{ inputStore.missedWords }} </small> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFps } from '@vueuse/core'
import { useStats } from '@/shared/lib/hooks/useStats'
import { useAccuracy } from '@/shared/lib/hooks/useAccuracy'
import logger from '@/shared/lib/helpers/logger'
import { useInputStore } from '@/entities/input/model'
import { useTestStateStore } from '@/entities/test'
import { useConfigStore } from '@/entities/config/model/store'
import { useTimerStore } from '@/entities/timer/model/store'

// Use hook to count FPS
const fps = useFps()
const minFps = ref(0)
const maxFps = ref(0)

// Calc AVG FPS
const avgFps = computed(() => Math.round(((minFps.value + fps.value + maxFps.value) / 3) * 10) / 10)

// Watch changes FPS to update values
watch(fps, (value: number) => {
  minFps.value = Math.min(minFps.value || value, value)
  maxFps.value = Math.max(maxFps.value, value)
})

const { getStats } = useStats()
const inputStore = useInputStore()
const testState = useTestStateStore()
const configStore = useConfigStore()
const timerStore = useTimerStore()
</script>
<style lang="scss">
.fps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: var(--fps-z);
  position: absolute;
  pointer-events: none;
  top: 20px;
  left: 20px;
  color: var(--text-color);

  & dl {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-weight: bold;
  }
}
</style>
