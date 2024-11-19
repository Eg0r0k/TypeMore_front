import { useConfigStore } from '@/entities/config/model/store'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@/entities/input/model'
import { useTestStateStore } from '@/entities/test'
import { useTimerStore } from '@/entities/timer/model/store'
import { computed, onUnmounted, ref, watch, watchEffect } from 'vue'
import { roundTo2 } from '../helpers/numbers'
import { getLastChar } from '../helpers/string'

type Stats = {
  wpm: number
  wpmRaw: number
  correctChars: number
  missedChars: number
  extraChars: number
  spaces: number
}

export const useStats = () => {
  const correctWordChars = ref(0)
  const correctChars = ref(0)
  const incorrectChars = ref(0)
  const extraChars = ref(0)
  const missedChars = ref(0)
  const spaces = ref(0)
  const correctSpaces = ref(0)
  const timerStore = useTimerStore()
  const { config } = useConfigStore()
  const testState = useTestStateStore()
  const inputStore = useInputStore()
  const generator = useWordGeneratorStore()

  const calculateTestSeconds = computed(() =>
    testState.isActive ? timerStore.getTime() : timerStore.time
  )

  const targetWords = computed(() => generator.retWords.words)
  const inputWords = computed(() => (inputStore.input ? inputStore.input.history : []))

  const wpmAndRaw = computed(() => {
    const testSeconds = calculateTestSeconds.value

    const wpm = roundTo2(((correctWordChars.value + correctSpaces.value) * (60 / testSeconds)) / 5)

    const raw = roundTo2(
      ((correctChars.value + spaces.value + incorrectChars.value + extraChars.value) *
        (60 / testSeconds)) /
        5
    )

    return {
      wpm: isNaN(Number(wpm)) ? 0 : wpm,
      raw: isNaN(Number(raw)) ? 0 : raw
    }
  })

  const wpm = computed(() => wpmAndRaw.value.wpm)
  const raw = computed(() => wpmAndRaw.value.raw)
  const resetStats = () => {
    correctWordChars.value = 0
    correctChars.value = 0
    incorrectChars.value = 0
    extraChars.value = 0
    missedChars.value = 0
    spaces.value = 0
    correctSpaces.value = 0
  }
  const calculateChars = () => {
    resetStats()
    if (!inputWords.value.length || !targetWords.value.length) {
      return
    }

    for (let i = 0; i < inputWords.value.length; i++) {
      const inputWord = inputWords.value[i] as string
      const targetWord = targetWords.value[i] as string
      if (inputWord === targetWord) {
        correctWordChars.value += targetWord.length
        correctChars.value += targetWord.length
        if (i < inputWords.value.length - 1 && getLastChar(inputWord as string) !== '\n') {
          correctSpaces.value++
        }
      } else if (inputWord.length >= targetWord.length) {
        for (let ch = 0; ch < inputWord.length; ch++) {
          if (ch < targetWord.length) {
            if (inputWord[ch] === targetWord[ch]) {
              correctChars.value++
            } else {
              incorrectChars.value++
            }
          } else {
            extraChars.value++
          }
        }
      } else {
        const toAdd = {
          correct: 0,
          incorrect: 0,
          missed: 0
        }
        for (let ch = 0; ch < targetWord.length; ch++) {
          if (ch < inputWord.length) {
            if (inputWord[ch] === targetWord[ch]) {
              toAdd.correct++
            } else {
              toAdd.incorrect++
            }
          } else {
            toAdd.missed++
          }
        }
        correctChars.value += toAdd.correct
        incorrectChars.value += toAdd.incorrect
        if (i === inputWords.value.length - 1 && config.mode === 'time') {
          if (toAdd.incorrect === 0) correctWordChars.value += toAdd.correct
        } else {
          console.log('missed')
          missedChars.value += toAdd.missed
        }
      }
      if (i < inputWords.value.length - 1) {
        spaces.value++
      }
    }
  }

  watch([inputWords, targetWords], calculateChars, { immediate: true })

  const intervalId = setInterval(calculateChars, 1000)

  onUnmounted(() => {
    clearInterval(intervalId)
  })

  const getStats = computed<Stats>(() => {
    return {
      wpm: wpm.value,
      wpmRaw: raw.value,
      correctChars: correctChars.value,
      missedChars: missedChars.value,
      extraChars: extraChars.value,
      spaces: spaces.value
    }
  })

  const setEnd = () => {
    calculateChars()
  }
  watchEffect(() => {
    if (testState.isActive) {
      calculateChars()
    }
  })
  const setStart = () => {
    resetStats()
  }

  return {
    getStats,
    setEnd,
    setStart,
    wpm,
    raw,
    calculateChars
  }
}
