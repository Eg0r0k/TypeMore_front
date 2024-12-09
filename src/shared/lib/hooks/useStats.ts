import { useConfigStore } from '@/entities/config/model/store'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@entities/input/model/store'
import { useTestStateStore } from '@/entities/test/model/store'

import { useTimerStore } from '@/entities/timer/model/store'
import { computed, ComputedRef, ref, watch, watchEffect } from 'vue'
import { roundTo2 } from '../helpers/numbers'
import { getLastChar } from '../helpers/string'
import { ConfigModes } from '@/shared/constants/type'

export interface UseStatsInterface {
  getStats: ComputedRef<Stats>
  setEnd: () => void
  setStart: () => void
  wpm: ComputedRef<number>
  raw: ComputedRef<number>
  calculateChars: () => void
}

type Stats = {
  wpm: number
  wpmRaw: number
  correctChars: number
  missedChars: number
  extraChars: number
  incorrectChars: number
  spaces: number
  correctSpaces: number
}

export const useStats = (): UseStatsInterface => {
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

    const timePerWord = 60 / testSeconds / 5

    const wpm = roundTo2((correctWordChars.value + correctSpaces.value) * timePerWord)
    const raw = roundTo2(
      (correctChars.value + spaces.value + incorrectChars.value + extraChars.value) * timePerWord
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
    const inputLength = inputWords.value.length
    const targetLength = targetWords.value.length

    if (!inputLength || !targetLength) {
      return
    }
    for (let i = 0; i < inputLength; i++) {
      const inputWord = inputWords.value[i] as string
      const targetWord = targetWords.value[i] as string

      if (inputWord === targetWord) {
        correctWordChars.value += targetWord.length
        correctChars.value += targetWord.length
        if (i < inputLength - 1 && getLastChar(inputWord) !== '\n') {
          correctSpaces.value++
        }
      } else {
        const wordLength = Math.max(inputWord.length, targetWord.length)
        let toAddCorrect = 0
        let toAddIncorrect = 0
        let toAddMissed = 0
        let extraCount = 0

        for (let ch = 0; ch < wordLength; ch++) {
          const inputChar = inputWord[ch]
          const targetChar = targetWord[ch]

          if (inputChar === targetChar) {
            toAddCorrect++
          } else if (ch < targetWord.length) {
            toAddIncorrect++
          } else {
            extraCount++
          }

          if (ch >= inputWord.length) {
            toAddMissed++
          }
        }
        correctChars.value += toAddCorrect
        incorrectChars.value += toAddIncorrect
        missedChars.value += toAddMissed
        if (i === inputLength - 1 && config.mode === ConfigModes.Time && toAddIncorrect === 0) {
          correctWordChars.value += toAddCorrect
        }
        if (extraCount > 0) {
          extraChars.value += extraCount
        }
      }
      if (i < inputLength - 1) {
        spaces.value++
      }
    }
  }

  watch([calculateTestSeconds], calculateChars, { immediate: true })

  const getStats = computed<Stats>(() => {
    return {
      wpm: wpm.value,
      wpmRaw: raw.value,
      incorrectChars: incorrectChars.value,
      correctChars: correctChars.value,
      missedChars: missedChars.value,
      extraChars: extraChars.value,
      spaces: spaces.value,
      correctSpaces: correctSpaces.value
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

// const calculateChars = () => {
//   resetStats()
//   if (!inputWords.value.length || !targetWords.value.length) {
//     return
//   }

//   for (let i = 0; i < inputWords.value.length; i++) {
//     const inputWord = inputWords.value[i] as string
//     const targetWord = targetWords.value[i] as string
//     if (inputWord === targetWord) {
//       correctWordChars.value += targetWord.length
//       correctChars.value += targetWord.length
//       if (i < inputWords.value.length - 1 && getLastChar(inputWord as string) !== '\n') {
//         correctSpaces.value++
//       }
//     } else if (inputWord.length >= targetWord.length) {
//       for (let ch = 0; ch < inputWord.length; ch++) {
//         if (ch < targetWord.length) {
//           if (inputWord[ch] === targetWord[ch]) {
//             correctChars.value++
//           } else {
//             incorrectChars.value++
//           }
//         } else {
//           extraChars.value++
//         }
//       }
//     } else {
//       const toAdd = {
//         correct: 0,
//         incorrect: 0,
//         missed: 0
//       }
//       for (let ch = 0; ch < targetWord.length; ch++) {
//         if (ch < inputWord.length) {
//           if (inputWord[ch] === targetWord[ch]) {
//             toAdd.correct++
//           } else {
//             toAdd.incorrect++
//           }
//         } else {
//           toAdd.missed++
//         }
//       }
//       correctChars.value += toAdd.correct
//       incorrectChars.value += toAdd.incorrect
//       if (i === inputWords.value.length - 1 && config.mode === 'time') {
//         if (toAdd.incorrect === 0) correctWordChars.value += toAdd.correct
//       } else {
//         // console.log('missed')
//         missedChars.value += toAdd.missed
//       }
//     }
//     if (i < inputWords.value.length - 1) {
//       spaces.value++
//     }
//   }
// }
