import { computed, ComputedRef, reactive } from 'vue'
export interface InputHookInterface {
  input: InputState
  inputHistoryLength: ComputedRef<number>
  inputLength: ComputedRef<number>

  resetInput: () => void
  setCurrent: (val: string) => void
  getCurrent: () => string

  popHistory: () => string
  pushToHistory: () => string
  getHistory: () => string[]
}
interface InputState {
  current: string
  history: string[]
}

export const useInputState = (): InputHookInterface => {
  const input = reactive<InputState>({
    current: '',
    history: []
  })
  const inputHistoryLength: ComputedRef<number> = computed(() => input.history.length)
  const inputLength: ComputedRef<number> = computed(() => input.current.length)

  const resetInput = () => {
    input.current = ''
    input.history = []
  }

  const setCurrent = (val: string): void => {
    input.current = val
  }
  const getCurrent = (): string => {
    return input.current
  }

  function popHistory(): string {
    return input.history.pop() ?? ''
  }

  const pushToHistory = (): string => {
    const previousInput = input.current
    console.trace('PUSHED TO HISTORY')
    if (previousInput) {
      input.history.push(previousInput)
    }
    input.current = ''
    return previousInput
  }

  const getHistory = (): string[] => {
    return input.history
  }
  return {
    input,
    inputHistoryLength,
    inputLength,
    resetInput,
    setCurrent,
    getCurrent,

    popHistory,
    pushToHistory,
    getHistory
  }
}
