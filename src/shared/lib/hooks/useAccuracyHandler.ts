import { ref } from 'vue'

export const useAccuracyHandler = () => {
  const characterCounts = ref({
    correct: 0,
    incorrect: 0,
    extra: 0,
    total: 0,
    correctSpaces: 0,
    incorrectSpaces: 0
  })
  const incrementCharacterCount = (isCorrect: boolean, charIndex: number, currentWord: string) => {
    characterCounts.value.total++

    if (isCorrect) {
      characterCounts.value.correct++
    } else {
      if (charIndex >= currentWord.length) {
        characterCounts.value.extra++
      } else {
        characterCounts.value.incorrect++
      }
    }
  }
  const resetCharacterCounts = (): void => {
    Object.keys(characterCounts.value).forEach((key) => {
      characterCounts.value[key as keyof typeof characterCounts.value] = 0
    })
  }
  return {
    characterCounts,
    incrementCharacterCount,
    resetCharacterCounts
  }
}
