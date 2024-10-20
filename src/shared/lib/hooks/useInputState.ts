import { computed, ComputedRef, reactive } from 'vue'
interface InputState {
  current: string
  history: string[]
}

export const useInputState = () => {
  const input = reactive<InputState>({
    current: '',
    history: []
  })
  const inputHistoryLength: ComputedRef<number> = computed(() => input.history.length)
  const inputLength: ComputedRef<number> = computed(() => input.current.length)

  const resetCurrent = (): void => {
    input.current = ''
  }
  const setCurrent = (val: string): void => {
    input.current = val
  }
  const getCurrent = (): string => {
    return input.current
  }
  const resetHistory = (): void => {
    input.history = []
  }
  function popHistory(): string {
    return input.history.pop() ?? ''
  }

  //? MB create this computed?
  const pushToHistory = (): string => {
    const previousInput = input.current
    input.history.push(input.current)
    resetCurrent()
    return previousInput
  }

  const getHistory = (): string[] => {
    return input.history
  }
  return {
    input,
    inputHistoryLength,
    inputLength,
    resetCurrent,
    setCurrent,
    getCurrent,
    resetHistory,
    popHistory,
    pushToHistory,
    getHistory
  }
}
