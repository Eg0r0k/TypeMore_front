import { useWordGeneratorStore } from '@/entities/generator/model/store'

import { computed, shallowRef, watch } from 'vue'

export const useUIState = () => {
  const generator = useWordGeneratorStore()
  const words = computed(() => generator.retWords.words)
  const letterClasses = shallowRef<string[][]>([])
  watch(
    words,
    (newWords) => {
      letterClasses.value = newWords.map((word) => Array(word.length).fill(''))
    },
    { immediate: true }
  )
  const updateLetterClasses = (currentWord: number, wordInputs: string[]) => {
    if (currentWord >= words.value.length) {
      console.warn('Trying to access word beyond array length. Stopping update.')
      return
    }

    const originalWord = words.value[currentWord]
    const currentInput = wordInputs[currentWord] || ''

    letterClasses.value[currentWord] = computeLetterClasses(originalWord, currentInput)
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
