import { useWordGeneratorStore } from '@/entities/generator/model/store'

import { computed } from 'vue'

export const useUIState = () => {
  const generator = useWordGeneratorStore()
  const words = computed(() => generator.retWords.words)

  const letterClasses = computed(() => words.value.map((word) => Array(word.length).fill('')))

  const updateLetterClasses = (currentWord: number, wordInputs: string[]) => {
    if (currentWord >= words.value.length) {
      console.warn('Trying to access word beyond array length. Stopping update.')
      return
    }
    letterClasses.value[currentWord] = computeLetterClasses(
      words.value[currentWord],
      wordInputs[currentWord] || ''
    )
  }
  const computeLetterClasses = (originalWord: string, currentInput: string): string[] => {
    if (!currentInput) {
      return Array(originalWord.length).fill('')
    }

    return originalWord
      .split('')
      .map((char, index) =>
        index >= currentInput.length ? '' : currentInput[index] === char ? 'correct' : 'incorrect'
      )
  }

  const getLetterClass = (wordIndex: number, letterIndex: number): string =>
    letterClasses.value[wordIndex]?.[letterIndex] || ''

  return {
    letterClasses,
    updateLetterClasses,
    getLetterClass
  }
}
