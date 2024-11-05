import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useTestStateStore } from '@/entities/test'
import { shallowRef } from 'vue'

export const useUIState = () => {
  const generator = useWordGeneratorStore()
  const letterClasses = shallowRef<string[][]>([])
  const initializeLetterClasses = () => {
    if (letterClasses.value.length > 0) return
    letterClasses.value = generator.retWords.words.map((word) =>
      Array.from({ length: word.length }, () => '')
    )
  }
  const updateLetterClasses = (currentWord: number, wordInputs: string[]) => {
    if (currentWord >= generator.retWords.words.length) {
      console.warn('Trying to access word beyond array length. Stopping update.')
      return
    }

    const originalWord = generator.retWords.words[currentWord]
    const currentInput = wordInputs[currentWord] || ''

    letterClasses.value[currentWord] = originalWord
      .split('')
      .map((char, index) =>
        index >= currentInput.length ? '' : currentInput[index] === char ? 'correct' : 'incorrect'
      )
  }
  const getLetterClass = (wordIndex: number, letterIndex: number): string =>
    letterClasses.value[wordIndex]?.[letterIndex] ?? ''

  return {
    letterClasses,
    initializeLetterClasses,
    updateLetterClasses,
    getLetterClass
  }
}
