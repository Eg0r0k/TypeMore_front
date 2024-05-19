import { useConfigStore } from '@/entities/config/store'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTimerStore = defineStore('timer', () => {
  const { config } = useConfigStore()
  const timer = ref<NodeJS.Timeout | null>(null)
  const interval = 1000
  const time = ref(0)

  const getTime = (): number => {
    return time.value
  }

  const setTime = (val: number): void => {
    time.value = val
  }

  const incrementTime = (): void => {
    time.value++
  }

  const checkIfTimeIsOver = (): void => {
    if (config.mode === 'time') {
      if (getTime() >= config.time && config.time !== 0) {
        if (timer.value !== null) {
          clearTimeout(timer.value)
          timer.value = null
        }
      }
    }
  }

  const clear = () => {
    setTime(0)
    if (timer.value !== null) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  const timerStep = () => {
    incrementTime()
    checkIfTimeIsOver()
  }

  const start = () => {
    if (timer.value === null) {
      let expected = Date.now() + interval

      const loop = () => {
        const drift = Date.now() - expected

        timerStep()

        expected += interval
        if (timer.value !== null) {
          timer.value = setTimeout(loop, Math.max(0, interval - drift))
        }
      }

      timer.value = setTimeout(loop, interval)
    }
  }

  return { start, clear, getTime, setTime, incrementTime, checkIfTimeIsOver, timerStep, timer }
})
