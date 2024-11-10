import { useWordGeneratorStore } from '@/entities/generator/model/store'

import { computed, shallowRef } from 'vue'

export const useUIState = () => {
  const generator = useWordGeneratorStore()
  const words = computed(() => generator.retWords.words)
  const letterClasses = shallowRef<string[][]>([])
  const initializeLetterClasses = () => {
    if (letterClasses.value.length || !words.value.length) return
    letterClasses.value = words.value.map((word) => Array(word.length).fill(''))
  }
  const updateLetterClasses = (currentWord: number, wordInputs: string[]) => {
    if (currentWord >= words.value.length) {
      console.warn('Trying to access word beyond array length. Stopping update.')
      return
    }

    const originalWord = words.value[currentWord]
    const currentInput = wordInputs[currentWord] || ''

    if (!currentInput) {
      letterClasses.value[currentWord] = Array(originalWord.length).fill('')
      return
    }

    letterClasses.value[currentWord] = originalWord
      .split('')
      .map((char, index) =>
        index >= currentInput.length ? '' : currentInput[index] === char ? 'correct' : 'incorrect'
      )
  }
  const getLetterClass = (wordIndex: number, letterIndex: number): string =>
    letterClasses.value[wordIndex]?.[letterIndex] || ''

  return {
    letterClasses,
    initializeLetterClasses,
    updateLetterClasses,
    getLetterClass
  }
}
