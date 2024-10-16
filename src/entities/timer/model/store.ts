import { useConfigStore } from '@/entities/config/model/store'
import { useTestStateStore } from '@/entities/test'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'
import WebWorker from '@/shared/lib/helpers/worker?worker'
import { useInputStore } from '@/entities/input/model'
import { useStats } from '@/shared/lib/hooks/useStats'

export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const input = useInputStore()
  const testState = useTestStateStore()
  const stats = useStats() // Access useStats composable
  const time = ref(0)
  let worker: Worker | null = null

  const createWorker = () => {
    worker = new WebWorker() as Worker
    worker.onmessage = (e) => {
      if (e.data.command === 'stop') {
        stopTimer()
      } else if (typeof e.data.timer !== 'undefined') {
        time.value = e.data.timer
        stats.calculateChars() // Call calculateChars when timer updates
      }
    }
  }

  const startTimer = (): void => {
    if (testState.isActive) {
      if (!worker) {
        createWorker()
      }
      if (worker) worker.postMessage({ command: 'start', time: config.time })
    }
  }

  const stopTimer = (): void => {
    if (worker) {
      worker.postMessage({ command: 'reset' })
      terminateWorker()
    }
    input.handleSpace()
    testState.isActive = false
  }

  const getTime = (): number => {
    return time.value
  }

  const resetTimer = (): void => {
    if (worker) {
      worker.postMessage({ command: 'reset' })
    }
  }

  const setTime = (val: number): void => {
    time.value = val
  }

  const terminateWorker = () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  onMounted(() => {
    createWorker()
  })

  return {
    getTime,
    setTime,
    time,
    startTimer,
    stopTimer,
    resetTimer,
    terminateWorker
  }
})
