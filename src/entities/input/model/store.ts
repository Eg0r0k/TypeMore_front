import { computed, markRaw, reactive, ref } from 'vue'

import { defineStore } from 'pinia'
import { useTestStateStore } from '../../test'
import { useWordGeneratorStore } from '../../generator/model/store'
import { useSounds } from '@/shared/lib/hooks/useSounds'

import { useAccuracy } from '@/shared/lib/hooks/useAccuracy'
import { useInputState } from '@/shared/lib/hooks/useInputState'
import click1 from '/static/sounds/click3/click6_1.wav'
import click2 from '/static/sounds/click3/click6_2.wav'
import click3 from '/static/sounds/click3/click6_3.wav'
import click4 from '/static/sounds/click3/click6_11.wav'
import click5 from '/static/sounds/click3/click6_22.wav'
import click6 from '/static/sounds/click3/click6_33.wav'

import errorSound from '/static/sounds/error/error1_1.wav'
import { useStats } from '@/shared/lib/hooks/useStats'
import { useErrorTracking } from '@/shared/lib/hooks/useErrorTracking'
import { useAccuracyHandler } from '@/shared/lib/hooks/useAccuracyHandler'
import { useUIState } from '@/shared/lib/hooks/useUIState'

type Keydata = {
  timestamp: number
  index: number
}

export const useInputStore = defineStore('input', () => {
  const keyDownData: Record<string, Keydata> = reactive({})
  const { accuracy, incrementAccuracy, resetAccuracy, accuracyPercentage } = useAccuracy()
  const currentWord = computed(() => generator.getCurrent())

  const { resetCharacterCounts, characterCounts, incrementCharacterCount } = useAccuracyHandler()
  const { missedWords, incrementKeypressErrors, pushMissedWords, errorHistory } = useErrorTracking()
  const { letterClasses, initializeLetterClasses, updateLetterClasses, getLetterClass } =
    useUIState()
  const wordInputs = ref<string[]>([])
  const currentKeypressCount = ref(0)
  const testState = useTestStateStore()
  const generator = markRaw(useWordGeneratorStore())

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

  const { playRandomClickSound, playErrorSound, setClickSounds, setErrorSound } = useSounds(
    [click1, click2, click3, click4, click5, click6],
    errorSound
  )

  const { getStats } = useStats()
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

    const thisCharCorrect = isCharCorrect(char, charIndex)
    incrementAccuracy(thisCharCorrect)

    incrementCharacterCount(thisCharCorrect, charIndex, currentWord.value)
    if (!thisCharCorrect && generator.getCurrent().charAt(charIndex) === '\n') {
      if (input.current === '') return
      char = ' '
    }
    if (thisCharCorrect) {
      playRandomClickSound()
    } else {
      console.log('incorrect')

      playErrorSound()
    }
  }
  const isCharCorrect = (char: string, charIndex: number): boolean => {
    return generator.getCurrent()[charIndex] === char
  }
  const handleInput = (event: Event): void => {
    if (!event.isTrusted) {
      ;(event.target as HTMLInputElement).value = ''
      return
    }
    const newValue = (event.target as HTMLInputElement).value.normalize()
    const oldValue = input.current

    const charsToProcess = newValue.slice(oldValue.length).replace(' ', '')
    charsToProcess.split('').forEach((char, i) => handleChar(char, oldValue.length + i))
    input.current = newValue
    console.log(input.current)
    wordInputs.value[testState.currentWordElementIndex] = input.current
    console.log(wordInputs.value[testState.currentWordElementIndex])
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
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
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
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
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
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
    accuracyPercentage,
    characterCounts,
    clearAllInputData,
    setWordToInput,
    handleInput,
    getStats,
    wordInputs
  }
})
