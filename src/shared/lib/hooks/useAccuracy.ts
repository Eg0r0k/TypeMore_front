import { Ref, ref } from 'vue'

interface Accuracy {
  correct: number
  incorrect: number
}
/**
 * Provides reactive state and methods for tracking accuracy.
 *
 * @returns An object containing the accuracy state, a method to increment accuracy, and a method to reset accuracy.
 */

export const useAccuracy = () => {
  const accuracy: Ref<Accuracy> = ref({ correct: 0, incorrect: 0 })
  /**
   * Increments the accuracy counts based on whether the given answer is correct.
   *
   * @param isCorrect
   */
  const incrementAccuracy = (isCorrect: boolean): void => {
    isCorrect ? accuracy.value.correct++ : accuracy.value.incorrect++
  }
  /**
   * Resets the accuracy counts to zero.
   */
  const resetAccuracy = () => {
    accuracy.value = { correct: 0, incorrect: 0 }
  }
  return {
    accuracy,
    incrementAccuracy,
    resetAccuracy
  }
}
