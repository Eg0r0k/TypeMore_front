import { useConfigStore } from '@/entities/config/store'
import { useInputStore } from '@/entities/input'
import { useTestStateStore } from '@/entities/test'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import WebWorker from '@/shared/lib/helpers/worker?worker'
export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const input = useInputStore()
  const testState = useTestStateStore()
  const time = ref(0)
  const worker = new WebWorker() as Worker
  worker.onmessage = (e) => {
    if (e.data.command === 'stop') {
      stopTimer()
    } else if (typeof e.data.timer !== 'undefined') {
      time.value = e.data.timer
      console.log(time.value)
    }
  }

  const startTimer = (): void => {
    if (testState.isActive) {
      worker.postMessage({ command: 'start', time: config.time })
    }
  }
  const stopTimer = (): void => {
    worker.postMessage({ command: 'reset' })
    input.pushToHistory()
    testState.isActive = false
  }
  const getTime = (): number => {
    return time.value
  }
  const resetTimer = (): void => {
    worker.postMessage({ command: 'reset' })
  }
  const setTime = (val: number): void => {
    time.value = val
  }

  return {
    getTime,
    setTime,
    time,
    startTimer,
    stopTimer,
    resetTimer
  }
})
