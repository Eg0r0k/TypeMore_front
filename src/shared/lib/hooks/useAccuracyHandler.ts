import { ref } from 'vue'

interface CharacterCounts {
  correct: number
  incorrect: number
  extra: number
  total: number
  correctSpaces: number
  incorrectSpaces: number
}

export const useAccuracyHandler = () => {
  const characterCounts = ref<CharacterCounts>({
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
    characterCounts,
    incrementCharacterCount,
    resetCharacterCounts
  }
}
