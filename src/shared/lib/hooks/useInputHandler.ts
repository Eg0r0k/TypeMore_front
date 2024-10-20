import { ref, reactive } from 'vue'

import { useInputState } from '@/shared/lib/hooks/useInputState'
import { useTestStateStore } from '@/entities/test'
import { useWordGeneratorStore } from '@/entities/generator/model/store'

export const useInputHandling = () => {
  const wordInputs = ref<string[]>([])
  const testState = useTestStateStore()
  const generator = useWordGeneratorStore()
  const { input, pushToHistory } = useInputState()

  const handleSpace = () => {
    if (!testState.isActive || input.current === '') return

    const isWordCorrect = generator.getCurrent() === input.current
    wordInputs.value[testState.currentWordElementIndex] = input.current

    if (isWordCorrect) {
      testState.incrementWordIndex()
    } else {
      pushToHistory()
      testState.incrementWordIndex()
    }
  }

  const backspaceToPrevious = () => {
    if (!testState.isActive || input.current.length !== 0) return
    if (input.history.length === 0 || testState.currentWordElementIndex === 0) return
    testState.decrementWordIndex()
    input.current = pushToHistory()
  }

  return {
    wordInputs,
    handleSpace,
    backspaceToPrevious
  }
}
