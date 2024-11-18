import { computed, ref } from 'vue'

import { useInputState } from '@/shared/lib/hooks/useInputState'
import { useTestStateStore } from '@/entities/test'
import { useWordGeneratorStore } from '@/entities/generator/model/store'

export const useInputHandling = () => {
  const wordInputs = ref<string[]>([])
  const testState = useTestStateStore()
  const generator = useWordGeneratorStore()
  const { input, pushToHistory } = useInputState()

  const isTestActive = computed(() => testState.isActive)
  const currentWord = computed(() => generator.getCurrent())

  const handleSpace = () => {
    if (!testState.isActive || input.current === '') return

    const isWordCorrect = currentWord.value === input.current
    wordInputs.value[testState.currentWordElementIndex] = input.current

    testState.incrementWordIndex()
    if (!isWordCorrect) {
      pushToHistory()
    }
  }

  const backspaceToPrevious = () => {
    if (!isTestActive.value || input.current.length !== 0) return
    if (testState.currentWordElementIndex === 0) return
    testState.decrementWordIndex()
    input.current = pushToHistory()
  }

  return {
    wordInputs,
    handleSpace,
    backspaceToPrevious
  }
}
