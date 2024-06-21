import { reactive, ref } from 'vue'
import { Input } from './types/input'
import { defineStore } from 'pinia'
import { useTestStateStore } from '../../test'
import { useWordGeneratorStore } from '../../generator/model/store'
// Keys kodes to track
const keysToTrack = [
  'KeyA',
  'KeyB',
  'KeyC',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyI',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyM',
  'KeyN',
  'KeyO',
  'KeyP',
  'KeyQ',
  'KeyR',
  'KeyS',
  'KeyT',
  'KeyU',
  'KeyV',
  'KeyW',
  'KeyX',
  'KeyY',
  'KeyZ',
  'NumpadDivide', //  key: "/"
  'NumpadMultiply', // key: "*"
  'NumpadDecimal', // key: "."
  'NumpadAdd', // key: "+"
  'NumpadEqual', // key: "="
  'NumpadSubtract', //key: "-"
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Minus',
  'Equal',
  'Enter',
  'Tab',
  'Space',
  'Slash',
  'Backslash',
  'Period',
  'BracketLeft',
  'BracketRight',
  'Comma',
  'Period',
  'Quote',
  'Semicolon',
  'IntlBackslash',
  'NoCode'
]
type Keydata = {
  timestamp: number
  index: number
}
type ErrorHistoryObject = {
  count: number
  words: number[]
}
export const useInputStore = defineStore('input', () => {
  const keyDownData: Record<string, Keydata> = reactive({})
  const missedWords = ref<Record<string, number>>({})
  const errorHistory: ErrorHistoryObject[] = reactive([])
  const currentKeypressCount = ref(0)
  const testState = useTestStateStore()
  const generator = useWordGeneratorStore()
  const input: Input = reactive({
    current: '',
    history: [],
    historyLength: 0,
    length: 0
  })
  const keypressTimings = reactive({
    spacing: {
      first: -1,
      last: -1,
      array: [] as number[]
    },
    duration: {
      array: [] as number[]
    }
  })
  const corrected = reactive({
    current: '',
    history: []
  })
  const resetKeypressTimings = (): void => {
    keypressTimings.spacing.first = -1
    keypressTimings.spacing.last = -1
    keypressTimings.spacing.array = []
    keypressTimings.duration.array = []
  }

  const reset = (): void => {
    resetCurrent()
    resetHistory()
  }

  const resetCurrent = (): void => {
    input.current = ''
  }
  const resetHistory = (): void => {
    input.history = []
    input.historyLength = 0
  }
  const getCurrent = (): string => {
    return input.current
  }
  const setCurrent = (val: string): void => {
    input.current = val
    input.length = input.current.length
  }
  const popHistory = (): string => {
    const ret = input.history.pop() ?? ''
    input.historyLength = input.history.length
    return ret
  }

  const pushToHistory = (): void => {
    input.history.push(input.current)
    input.historyLength = input.history.length
    resetCurrent()
  }

  const pushMissedWords = (word: string): void => {
    missedWords.value[word] = (missedWords.value[word] || 0) + 1
  }

  const handleSpace = () => {
    if (!testState.isActive || input.current === '') return
    const currentWord = generator.getCurrent()
    const isWordCorrect = currentWord === input.current
    if (isWordCorrect) {
      pushToHistory()
      incrementKeypressCount()
      testState.incrementWordIndex()
    } else {
      pushMissedWords(generator.getCurrent())
      pushToHistory()
      incrementKeypressCount()
      testState.incrementWordIndex()
    }
  }

  const restart = () => {
    missedWords.value = {}
  }

  const handleChars = () => {}

  const backspaceToPrevious = (): void => {
    if (
      input.history.length === 0 ||
      input.current.length !== 0 ||
      testState.currentWordElementIndex === 0
    ) {
      return
    }
    testState.setCurrentWordElementIndex(testState.currentWordElementIndex - 1)
    input.current = popHistory()
  }

  const incrementKeypressCount = () => {
    currentKeypressCount.value++
  }

  const recordKeyDown = (now: number, key: string): void => {
    if (!keysToTrack.includes(key)) {
      console.debug('Key not tracked', now, key)
      return
    }
    if (keypressTimings.spacing.first === -1) {
      keypressTimings.spacing.first = now
    } else {
      keypressTimings.spacing.array.push(now - keypressTimings.spacing.last)
    }
    keypressTimings.spacing.last = now
  }
  const recordKeyUp = (now: number, key: string): void => {
    if (!keysToTrack.includes(key)) {
      console.debug('Key not tracked', now, key)
      return
    }
    keypressTimings.duration.array.push(now - keypressTimings.spacing.last)
  }

  return {
    reset,
    setCurrent,
    resetCurrent,
    getCurrent,
    pushToHistory,
    missedWords,
    resetHistory,
    input,
    backspaceToPrevious,
    handleSpace,
    recordKeyDown,
    recordKeyUp,
    keypressTimings
  }
})
