import { Ref, ref } from 'vue'

interface Accuracy {
  correct: number
  incorrect: number
}
export const useAccuracy = () => {
  const accuracy: Ref<Accuracy> = ref({ correct: 0, incorrect: 0 })
  const incrementAccuracy = (isCorrect: boolean): void => {
    isCorrect ? accuracy.value.correct++ : accuracy.value.incorrect++
  }
  const resetAccuracy = () => {
    accuracy.value = { correct: 0, incorrect: 0 }
  }
  return {
    accuracy,
    incrementAccuracy,
    resetAccuracy
  }
}
