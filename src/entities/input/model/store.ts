import { computed, ComputedRef, markRaw, reactive, Ref, ref, shallowRef } from 'vue'
import { Input } from './types/input'
import { defineStore } from 'pinia'
import { useTestStateStore } from '../../test'
import { useWordGeneratorStore } from '../../generator/model/store'
import { useSounds } from '@/shared/lib/hooks/useSounds'
import { useTimerStore } from '@/entities/timer/model/store'
import { useAccuracy } from '@/shared/lib/hooks/useAccuracy'
import { useInputState } from '@/shared/lib/hooks/useInputState'
import { roundTo2 } from '@/shared/lib/helpers/numbers'
import { useStats } from '@/shared/lib/hooks/useStats'

// Keys kodes to track
const KAYS_TO_TRACK = [
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

interface ErrorHistoryObject {
  count: number
  words: string[]
}

interface Accuracy {
  correct: number
  incorrect: number
}

interface InputState {
  current: string
  history: string[]
}

export const useInputStore = defineStore('input', () => {
  const keyDownData: Record<string, Keydata> = reactive({})
  const missedWords = ref<Record<string, number>>({})
  const errorHistory = ref<ErrorHistoryObject>({ count: 0, words: [] })
  const letterClasses = shallowRef<string[][]>([])
  const currentWord = computed(() => generator.getCurrent())

  const characterCounts = ref({
    correct: 0,
    incorrect: 0,
    extra: 0,
    total: 0,
    correctSpaces: 0,
    incorrectSpaces: 0
  })

  const wordInputs = ref<string[]>([])
  const currentKeypressCount = ref(0)
  const testState = useTestStateStore()
  const generator = markRaw(useWordGeneratorStore())
  const { accuracy, incrementAccuracy, resetAccuracy } = useAccuracy()
  const {
    input,
    inputHistoryLength,
    inputLength,
    resetCurrent,
    resetHistory,
    getCurrent,
    setCurrent,
    popHistory,
    pushToHistory
  } = useInputState()
  const { playClickSound } = useSounds()
  const { wpm, raw, getStats } = useStats()
  const corrected = reactive({
    current: '',
    history: [] as string[]
  })

  const handleChar = (char: string, charIndex: number): void => {
    console.log('char', char)
    if (char === '…' && generator.getCurrent()[charIndex] !== '…') {
      for (let i = 0; i < 3; i++) handleChar('.', charIndex + i)
      return
    }

    if (char === 'œ' && generator.getCurrent()[charIndex] !== 'œ') {
      handleChar('o', charIndex)
      handleChar('e', charIndex + 1)
      return
    }

    if (char === 'æ' && generator.getCurrent()[charIndex] !== 'æ') {
      handleChar('a', charIndex)
      handleChar('e', charIndex + 1)
      return
    }

    if (char !== '\n' && char !== '\t' && /\s/.test(char)) {
      handleSpace()
      return
    }

    const thisCharCorrect = memoizedIsCharCorrect.value(char, charIndex)
    incrementAccuracy(thisCharCorrect)

    incrementCharacterCount(char, thisCharCorrect, charIndex)
    if (!thisCharCorrect && generator.getCurrent().charAt(charIndex) === '\n') {
      if (input.current === '') return
      char = ' '
    }
    playClickSound()
    if (thisCharCorrect) {
      //
    } else {
      console.log('incorrect')
    }
  }
  const memoizedIsCharCorrect = computed(() => {
    const memo = new Map<string, boolean>()
    return (char: string, charIndex: number): boolean => {
      const key = `${char}-${charIndex}`
      if (!memo.has(key)) {
        memo.set(key, generator.getCurrent()[charIndex] === char)
      }
      return memo.get(key)!
    }
  })
  const resetCharacterCounts = (): void => {
    Object.keys(characterCounts.value).forEach((key) => {
      characterCounts.value[key as keyof typeof characterCounts.value] = 0
    })
  }

  const handleInput = (event: Event): void => {
    if (!event.isTrusted) {
      ;(event.target as HTMLInputElement).value = ''
      return
    }

    const newValue = ref((event.target as HTMLInputElement).value.normalize())
    const oldValue = ref(input.current)
    const changedChars = newValue.value.slice(oldValue.value.length)
    changedChars.split('').forEach((char, i) => handleChar(char, oldValue.value.length + i))
    input.current = newValue.value
    console.log(input.current)
    wordInputs.value[testState.currentWordElementIndex] = input.current
    console.log(wordInputs.value[testState.currentWordElementIndex])
    updateLetterClasses()
  }
  const incrementKeypressErrors = () => {
    errorHistory.value.count++
  }
  const handleSpace = () => {
    if (!testState.isActive || input.current === '') return

    const isWordCorrect = currentWord.value === input.current
    incrementAccuracy(isWordCorrect)
    wordInputs.value[testState.currentWordElementIndex] = input.current

    if (isWordCorrect) {
      characterCounts.value.correctSpaces++

      pushToHistory()
      testState.incrementWordIndex()
    } else {
      characterCounts.value.incorrectSpaces++
      pushMissedWords(currentWord.value)
      testState.incrementWordIndex()
      incrementKeypressErrors()
      pushToHistory()
    }
    incrementKeypressCount()
    characterCounts.value.total++
    if (testState.currentWordElementIndex === generator.retWords.words.length) {
      console.debug('test finished')
      testState.finish()
      return
    }
    updateLetterClasses()
  }

  const incrementCharacterCount = (char: string, isCorrect: boolean, charIndex: number): void => {
    characterCounts.value.total++

    if (isCorrect) {
      characterCounts.value.correct++
    } else {
      if (charIndex >= currentWord.value.length) {
        characterCounts.value.extra++
      } else {
        characterCounts.value.incorrect++
      }
    }
  }

  const pushMissedWords = (word: string): void => {
    missedWords.value[word] = (missedWords.value[word] || 0) + 1
  }

  const clearAllInputData = () => {
    resetCurrent()
    resetHistory()
    corrected.current = ''
    corrected.history = []
    wordInputs.value = []
    resetCharacterCounts()
    resetAccuracy()
    missedWords.value = {}
    errorHistory.value = { count: 0, words: [] }
    letterClasses.value = []
  }

  const initializeLetterClasses = () => {
    if (letterClasses.value.length > 0) return
    letterClasses.value = generator.retWords.words.map((word) =>
      Array.from({ length: word.length }, () => '')
    )
  }
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
  const getLetterClass = (wordIndex: number, letterIndex: number): string =>
    letterClasses.value[wordIndex]?.[letterIndex] ?? ''

  const getExtraLetters = (wordIndex: number): string => {
    const originalWord = generator.retWords.words[wordIndex]
    const currentInput = wordInputs.value[wordIndex] || ''
    return currentInput.length > originalWord.length ? currentInput.slice(originalWord.length) : ''
  }
  const setWordToInput = (value: string) => {
    input.current = value
  }
  const backspaceToPrevious = (): void => {
    if (!testState.isActive) return
    if (input.current.length !== 0) return

    if (input.history.length === 0 || testState.currentWordElementIndex === 0) return

    testState.decrementWordIndex()
    input.current = popHistory()

    wordInputs.value[testState.currentWordElementIndex] = input.current
    updateLetterClasses()
  }

  const incrementKeypressCount = () => {
    currentKeypressCount.value++
  }

  return {
    setCurrent,
    resetCurrent,
    getCurrent,
    pushToHistory,
    missedWords,
    resetHistory,
    input,
    getExtraLetters,
    backspaceToPrevious,
    handleSpace,
    initializeLetterClasses,
    getLetterClass,
    accuracy,
    characterCounts,
    clearAllInputData,
    wpm,
    raw,
    setWordToInput,
    isCharCorrect: memoizedIsCharCorrect.value,
    handleInput,
    getStats,
    wordInputs
  }
})
