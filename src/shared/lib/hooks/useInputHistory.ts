import { Ref, ref } from 'vue'

export const useInputHistory = () => {
  const inputHistory: Ref<string[]> = ref([])
  const currentInput: Ref<string> = ref('')

  const pushToHistory = (input: string): void => {
    inputHistory.value.push(input)
    currentInput.value = ''
  }

  const popFromHistory = (): string => {
    return inputHistory.value.pop() || ''
  }

  const resetHistory = (): void => {
    inputHistory.value = []
    currentInput.value = ''
  }

  return {
    currentInput,
    inputHistory,
    pushToHistory,
    popFromHistory,
    resetHistory
  }
}
