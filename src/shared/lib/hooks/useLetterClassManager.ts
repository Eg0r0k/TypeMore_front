import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useTestStateStore } from '@/entities/test'
import { ref } from 'vue'

export const useLetterClassManagement = () => {
  const letterClasses = ref<string[][]>([])
  const wordInputs = ref<string[]>([])
  const { currentWordElementIndex } = useTestStateStore()
  const { retWords } = useWordGeneratorStore()

  const updateLetterClasses = (): void => {
    const currentWord = currentWordElementIndex
    const words = retWords.words
    if (currentWord < 0 || currentWord >= words.length) {
      return
    }

    const originalWord = words[currentWord]
    const currentInput = wordInputs.value[currentWord] || ''

    letterClasses.value = [
      ...letterClasses.value.slice(0, currentWord),
      originalWord.split('').map((char, index) => {
        if (index >= currentInput.length) return ''
        return currentInput[index] === char ? 'correct' : 'incorrect'
      }),
      ...letterClasses.value.slice(currentWord + 1)
    ]
  }
  return {
    letterClasses,
    updateLetterClasses
  }
}
