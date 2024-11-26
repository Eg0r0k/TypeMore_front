import { ref } from 'vue'

type CharacterCounts = {
  correct: number
  incorrect: number
  extra: number
  total: number
  correctSpaces: number
  incorrectSpaces: number
}
/**
 * Handle words statistic
 * @returns Object containing the chars statistic, a method to increment charter count statiscit and a method to clear statistic
 */
export const useAccuracyHandler = () => {
  const characterCounts = ref<CharacterCounts>({
    correct: 0,
    incorrect: 0,
    extra: 0,
    total: 0,
    correctSpaces: 0,
    incorrectSpaces: 0
  })
  const incrementSpaces = (isCorrect: boolean) => {
    if (isCorrect) {
      characterCounts.value.correctSpaces++
    } else {
      characterCounts.value.incorrectSpaces++
    }
    characterCounts.value.total++
  }
  const incrementCharacterCount = (isCorrect: boolean, charIndex: number, currentWord: string) => {
    characterCounts.value.total++

    if (isCorrect) {
      characterCounts.value.correct++
    } else if (charIndex >= currentWord.length) {
      characterCounts.value.extra++
    } else {
      characterCounts.value.incorrect++
    }
  }
  /**
   * Reset all word statistics
   */
  const resetCharacterCounts = (): void => {
    characterCounts.value = {
      correct: 0,
      incorrect: 0,
      extra: 0,
      total: 0,
      correctSpaces: 0,
      incorrectSpaces: 0
    }
  }
  return {
    incrementSpaces,
    characterCounts,
    incrementCharacterCount,
    resetCharacterCounts
  }
}
