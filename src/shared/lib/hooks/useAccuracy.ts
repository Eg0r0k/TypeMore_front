import { computed, Ref, ref } from 'vue'
import { roundTo2 } from '../helpers/numbers'

interface Accuracy {
  correct: number
  incorrect: number
}

/**
 * Provides reactive state and methods for tracking accuracy.
 *
 * @param initialValues - Optional initial values for correct and incorrect counts.
 * @returns An object containing the accuracy state, a method to increment accuracy, and a method to reset accuracy.
 */
export const useAccuracy = (initialValues: Accuracy = { correct: 0, incorrect: 0 }) => {
  const accuracy: Ref<Readonly<Accuracy>> = ref({ ...initialValues })

  /**
   * Increments the accuracy counts based on whether the given answer is correct.
   *
   * @param isCorrect - Whether the answer is correct.
   */
  const incrementAccuracy = (isCorrect: boolean): void => {
    const { correct, incorrect } = accuracy.value
    accuracy.value = {
      correct: isCorrect ? correct + 1 : correct,
      incorrect: isCorrect ? incorrect : incorrect + 1
    }
  }

  /**
   * Resets the accuracy counts to zero.
   */
  const resetAccuracy = (): void => {
    accuracy.value = { correct: 0, incorrect: 0 }
  }

  const accuracyPercentage = computed(() => {
    const total = accuracy.value.correct + accuracy.value.incorrect
    return total > 0 ? roundTo2((accuracy.value.correct / total) * 100) : 100
  })

  return {
    accuracy,
    accuracyPercentage,
    incrementAccuracy,
    resetAccuracy
  }
}
