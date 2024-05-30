import { useConfigStore } from '@/entities/config/store'
import { useInputStore } from '@/entities/input'
import { useTestStateStore } from '@/entities/test'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const input = useInputStore()
  const testState = useTestStateStore()
  const time = ref(0)
  //!!!CHANGE URL!!!!!!
  const worker = new Worker('./src/shared/lib/helpers/worker.ts') as Worker
  worker.onmessage = (e) => {
    if (e.data.command === 'stop') {
      stopTimer()
    } else {
      time.value = e.data.timer
    }
  }

  const startTimer = () => {
    if (testState.isActive) {
      worker.postMessage({ command: 'start', time: config.time })
    }
  }
  const stopTimer = () => {
    worker.postMessage({ command: 'stop' })
    input.pushToHistory()
    testState.isActive = false
  }
  const getTime = (): number => {
    return time.value
  }
  const resetTimer = () => {
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
