<template>
  <div>
    <TestChart />
    <p style="color: white">Current: {{ inputStore.input.current }}</p>
    <p style="color: white">History: {{ inputStore.input.history }}</p>
    <p style="color: white">keypressTimings: {{ inputStore.keypressTimings.spacing }}</p>

    <p style="color: white">Timer: {{ timerStore.time }}</p>
    <div v-if="lang">
      <p
        class="word"
        style="color: white"
        v-for="(word, index) in lang.words"
        :key="`${index + word}`"
      >
        <span v-for="(letter, index) in word" :key="`${index + word}`">
          {{ letter }}
        </span>
      </p>
    </div>
    <p v-else style="color: white">Loading...</p>
    <div>
      <Button style="width: 100%">Start</Button>
    </div>
    <input
      type="text"
      @keyup="recordKeyUp"
      @keydown="recordKeyDown"
      @input="startTest"
      v-model="inputStore.input.current"
      @keydown.space.prevent="inputStore.handleSpace"
      @keydown.delete="inputStore.backspaceToPrevious"
      dir="auto"
    />
    <KeyMap />
  </div>
</template>

<script setup lang="ts">
import { TestChart } from '@/shared/ui/chart'
import { useConfigStore } from '@/entities/config/model/store'
import { useTestStateStore } from '@/entities/test'
import { Button } from '@/shared/ui/button'
import { useInputStore } from '@/entities/input/model/store'
import { useTimerStore } from '@entities/timer/model/store'
import {  ref } from 'vue'
import { KeyMap } from '@/features/layouts/keymap'
import { LanguageObj } from '@/shared/constants/type'

const testState = useTestStateStore()
const timerStore = useTimerStore()
const inputStore = useInputStore()
const { config } = useConfigStore()
const lang = ref<LanguageObj>()

const startTest = () => {
  if (!testState.isActive) {
    testState.setActive(true)
    timerStore.resetTimer()
    timerStore.startTimer()
  }
}
const recordKeyDown = (event: KeyboardEvent) => {
  const now = performance.now()

  let keyCode = event.code
  if (keyCode === 'NumpadEnter') {
    keyCode = 'Space'
    inputStore.handleSpace()
  }
  setTimeout(() => {
    const finalKeyCode = keyCode === '' || event.which === 231 ? 'NoCode' : keyCode
    console.log(finalKeyCode)
    inputStore.recordKeyDown(now, finalKeyCode)
  }, 0)
}
const recordKeyUp = (event: KeyboardEvent) => {
  const now = performance.now()

  let keyCode = event.code
  if (keyCode === 'NumpadEnter') {
    keyCode = 'Space'
    inputStore.handleSpace()
  }
  setTimeout(() => {
    const finalKeyCode = keyCode === '' || event.which === 231 ? 'NoCode' : keyCode
    inputStore.recordKeyUp(now, finalKeyCode)
  }, 0)
}





</script>

<style scoped lang="scss">
.word {
  display: inline-block;
  padding: 5px;
}
</style>
