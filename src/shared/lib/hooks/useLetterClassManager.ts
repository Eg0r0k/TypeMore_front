import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useTestStateStore } from '@/entities/test'
import { ref } from 'vue'

export const useLetterClassManagement = () => {
  const letterClasses = ref<string[][]>([])
  const wordInputs = ref<string[]>([])
  const testState = useTestStateStore()
  const generator = useWordGeneratorStore()

  const updateLetterClasses = (): void => {
    const currentWord = testState.currentWordElementIndex
    if (currentWord >= generator.retWords.words.length) {
      console.warn('Trying to access word beyond array length. Stopping update.')
      return
    }

    const originalWord = generator.retWords.words[currentWord]
    const currentInput = wordInputs.value[currentWord] || ''

    letterClasses.value[currentWord] = originalWord
      .split('')
      .map((char, index) =>
        index >= currentInput.length ? '' : currentInput[index] === char ? 'correct' : 'incorrect'
      )
  }
  return {
    letterClasses,
    updateLetterClasses
  }
}
