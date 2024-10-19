import { computed, Ref, ref } from 'vue'
import { roundTo2 } from '../helpers/numbers'

interface Accuracy {
  correct: number
  incorrect: number
}
/**
 * Provides reactive state and methods for tracking accuracy.
 *
 * @returns An object containing the accuracy state, a method to increment accuracy, and a method to reset accuracy.
 */

export const useAccuracy = (initialValues: Accuracy = { correct: 0, incorrect: 0 }) => {
  const accuracy: Ref<Accuracy> = ref({ ...initialValues })
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
  const accuracyPercentage = computed(() => {
    const total = accuracy.value.correct + accuracy.value.incorrect
    const acc = total === 0 ? 100 : (accuracy.value.correct / total) * 100
    return roundTo2(acc)
  })

  return {
    accuracy,
    accuracyPercentage,
    incrementAccuracy,
    resetAccuracy
  }
}
