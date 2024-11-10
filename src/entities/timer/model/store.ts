import { useConfigStore } from '@/entities/config/model/store'
import { useTestStateStore } from '@/entities/test'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'
import WebWorker from '@/shared/lib/helpers/worker?worker'
import { useInputStore } from '@/entities/input/model'
import { useStats } from '@/shared/lib/hooks/useStats'
/**
 * Store for managing a timer in a web worker.
 * This store is responsible for handling time tracking during the test, using Web Workers
 * to avoid JavaScript timer throttling issues and ensuring accurate time counting.
 */
export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const input = useInputStore()
  const testState = useTestStateStore()
  const stats = useStats()

  const time = ref(0)
  let worker: Worker | null = null
  /**
   * Initializes a Web Worker to handle the timer in a separate thread.
   * The worker listens for messages, updating the time or stopping the timer.
   */
  const createWorker = (): void => {
    if (worker) return
    worker = new WebWorker()
    worker.onmessage = (e) => {
      if (e.data.command === 'stop') {
        stopTimer()
      } else if (typeof e.data.timer !== 'undefined') {
        time.value = e.data.timer
        stats.calculateChars()
      }
    }
  }
  /**
   * Starts the timer by sending a start command to the Web Worker.
   * The timer will only start if the test is active.
   */
  const startTimer = (): void => {
    if (testState.isActive) {
      if (!worker) {
        createWorker()
      }
      if (worker) worker.postMessage({ command: 'start', time: config.time })
    }
  }
  /**
   * Stops the timer and resets the worker.
   * This also triggers handling input space and sets the test as inactive.
   */
  const stopTimer = (): void => {
    if (worker) {
      worker.postMessage({ command: 'reset' })
      terminateWorker()
    }
    input.handleSpace()
    testState.finish()
  }
  /**
   * Returns the current time value in the timer.
   * @returns The current timer value.
   */
  const getTime = (): number => {
    return time.value
  }
  /**
   * Resets the timer by sending a reset command to the Web Worker.
   */
  const resetTimer = (): void => {
    if (worker) {
      worker.postMessage({ command: 'reset' })
    }
  }
  /**
   * Sets the current time value manually.
   * @param val - The value to set the timer to. The value must be non-negative.
   */
  const setTime = (val: number): void => {
    if (val >= 0) {
      time.value = val
    }
  }
  /**
   * Terminates the current Web Worker and clears the reference to it.
   * This ensures that the worker is properly cleaned up.
   */
  const terminateWorker = () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }
  // Automatically create the Web Worker when the component is mounted

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
