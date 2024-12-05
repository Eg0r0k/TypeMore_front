<template>
  <DevtoolsLabel>
    <template #label>Test Info</template>
    <p class="stat-line">
      <span>Timer:</span>
      <span>
        <NumberFlow :value="hours" :format="{ minimumIntegerDigits: 2 }" />
        <span>:</span>
        <NumberFlow :value="minutes" :format="{ minimumIntegerDigits: 2 }" />
        <span>:</span>
        <NumberFlow :value="seconds" :format="{ minimumIntegerDigits: 2 }" />
      </span>
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
      <span>Incorrect Chars:</span>
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
    <small>History: {{ inputStore.input.history }}</small>
    <br />
    <small>Miss: {{ inputStore.missedWords }}</small>
  </DevtoolsLabel>
</template>

<script setup lang="ts">
  import { useConfigStore } from '@/entities/config/model/store'
  import { useInputStore } from '@/entities/input'
  import { useTestStateStore } from '@/entities/test'
  import { useTimerStore } from '@/entities/timer/model/store'
  import { useStats } from '@/shared/lib/hooks/useStats'
  import { DevtoolsLabel } from '../label'
  import NumberFlow from '@number-flow/vue'
  import { computed } from 'vue'

  const { getStats } = useStats()
  const inputStore = useInputStore()
  const configStore = useConfigStore()
  const timerStore = useTimerStore()
  const testState = useTestStateStore()
  const hours = computed(() => Math.floor(timerStore.time / 3600))
  const minutes = computed(() => Math.floor((timerStore.time % 3600) / 60))
  const seconds = computed(() => timerStore.time % 60)
</script>

<style lang="scss" scoped>
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
</style>
