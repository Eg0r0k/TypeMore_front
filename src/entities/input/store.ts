import { reactive } from 'vue'
import { Input } from './types'
import { defineStore } from 'pinia'

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

export const useInputStore = defineStore('input', () => {
  const input: Input = reactive({
    current: '',
    history: [],
    historyLength: 0,
    length: 0
  })
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
  // const handleSpace = () => {
  //   if (input.current === '') {
  //     return
  //   }
  //   setCurrent(input.history[input.historyLength - 1])
  //   popHistory()
  // }
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
  const backspaceToPrevious = (): void => {
    if(input.history.length === 0 ) {
      return
    }
    input.current = popHistory()
    
  }
  return {
    reset,
    setCurrent,
    resetCurrent,
    getCurrent,
    pushToHistory,
    resetHistory,
    input,
    backspaceToPrevious
  }
})
