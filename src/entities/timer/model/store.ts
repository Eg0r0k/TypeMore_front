import { useConfigStore } from '@/entities/config/model/store'
import { useTestStateStore } from '@/entities/test'
import { defineStore } from 'pinia'
import WebWorker from '@/shared/lib/helpers/worker?worker'
import { useInputStore } from '@/entities/input'
import { useStats } from '@/shared/lib/hooks/useStats'
import { WorkerService, useWorkerService } from '@/shared/lib/hooks/useWorkerManager'
import { ref } from 'vue'
/**
 * Store for managing a timer in a web worker.
 * This store is responsible for handling time tracking during the test, using Web Workers
 * to avoid JavaScript timer throttling issues and ensuring accurate time counting.
 */
export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const testState = useTestStateStore()
  const input = useInputStore()
  const stats = useStats()

  const time = ref(0)
  /**
   * @constant {WorkerService} workerService - Instance of the worker service, managing the Web Worker lifecycle and communication
   * @see module:@shared/lib/hooks/useWorkerManager
   */
  const workerService: WorkerService = useWorkerService(WebWorker)
  /**
   * Event listener for 'tick' events emitted by the Web Worker. Updates the current time and recalculates typing statistics
   */
  workerService.onTick((newTime) => {
    time.value = newTime
    stats.calculateChars()
  })
  /**
   * Event listener for 'stop' events emitted by the Web Worker. Triggers end-of-test actions, including handling the last space input and marking the test as finished
   */
  workerService.onStop(() => {
    input.handleSpace()
    testState.finish()
  })
  /**
   * Starts the timer.  If the test is active, it initializes the Web Worker with the configured test duration.
   */
  const startTimer = (): void => {
    if (testState.isActive) {
      workerService.start(config.time)
    }
  }
  /**
   * Stops the timer by sending a stop signal to the Web Worker
   */
  const stopTimer = (): void => {
    workerService.stop()
  }
  /**
   * Retrieves the current time elapsed on the timer
   * @returns {number} The current time in seconds
   */
  const getTime = (): number => {
    return time.value
  }
  /**
   * Resets the timer to zero
   */
  const resetTimer = (): void => {
    workerService.reset()
  }

  /**
   * Sets the timer to a specific value.  The value must be non-negative
   * @param {number} val - The new time value in seconds
   */
  const setTime = (val: number): void => {
    if (val >= 0) {
      time.value = val
    }
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
