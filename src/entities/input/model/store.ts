import { computed, reactive, ref } from 'vue'

import { defineStore } from 'pinia'

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
import { useErrorHistory, useErrorTracking } from '@/shared/lib/hooks/useErrorTracking'
import { useAccuracyHandler } from '@/shared/lib/hooks/useAccuracyHandler'
import { useUIState } from '@/shared/lib/hooks/useUIState'
import { KAYS_TO_TRACK, MAX_OVERINCORRECT_LETTERS } from '../const/keys'
import { useReplayStore } from '@/entities/replay/model/store'
import { useKeypressTracking } from '@/shared/lib/hooks/useKeypressTracking'
import { useTestStateStore } from '@/entities/test/model/store'

//TODO: Make delete events for replay. Make ctr + delete events for replay. Handle special chars ☻
export const useInputStore = defineStore('input', () => {
  const { recordKeydownTime, recordKeyupTime, resetKeypressTimings } = useKeypressTracking()
  const { input, resetInput, getCurrent, setCurrent, popHistory, pushToHistory } = useInputState()
  const { accuracy, incrementAccuracy, resetAccuracy, accuracyPercentage } = useAccuracy()
  const { resetCharacterCounts, characterCounts, incrementSpaces, incrementCharacterCount } =
    useAccuracyHandler()
  const { missedWords, pushMissedWordWithHistory, resetAllErrors } = useErrorTracking()
  const { letterClasses, updateLetterClasses, getLetterClass } = useUIState()
  const { incrementKeypressErrors } = useErrorHistory()
  const { getStats } = useStats()

  //TODO: Remake this shit, make change sound in config store!
  const { playRandomClickSound, playErrorSound } = useSounds(
    [click1, click2, click3, click4, click5, click6],
    errorSound
  )

  const replayStore = useReplayStore()
  const testState = useTestStateStore()
  const generator = useWordGeneratorStore()

  const currentWord = computed(() => generator.getCurrent())

  const wordInputs = ref<string[]>([])
  //! What is it do?
  const currentKeypressCount = ref(0)
  const corrected = reactive({
    current: '',
    history: [] as string[]
  })

  const handleChar = (char: string, charIndex: number): void => {
    requestAnimationFrame(() => {
      const thisCharCorrect = isCharCorrect(char, charIndex)
      incrementAccuracy(thisCharCorrect)

      incrementCharacterCount(thisCharCorrect, charIndex, currentWord.value)
      if (!thisCharCorrect && generator.getCurrent().charAt(charIndex) === '\n') {
        if (input.current === '') return
        char = ' '
      }
      replayStore.addReplayEvent(thisCharCorrect ? 'correctLetter' : 'incorrectLetter', char)
      if (thisCharCorrect) {
        playRandomClickSound()
      } else {
        // console.log('incorrect')
        playErrorSound()
      }
    })
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

    const originalWord = generator.retWords.words[testState.currentWordElementIndex] || ''

    const maxLength = originalWord.length + MAX_OVERINCORRECT_LETTERS

    if (newValue.length > maxLength) {
      ;(event.target as HTMLInputElement).value = newValue.slice(0, maxLength)
      return
    }
    const charsToProcess = newValue.slice(oldValue.length).replace(' ', '')
    charsToProcess.split('').forEach((char, i) => handleChar(char, oldValue.length + i))

    input.current = newValue
    // console.log(input.current)
    wordInputs.value[testState.currentWordElementIndex] = input.current
    // console.log(wordInputs.value[testState.currentWordElementIndex])
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    const now = performance.now()
    recordKeydownTime(now, event.key)
    // console.log(keyDownData, keypressTimings)
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    const now = performance.now()
    recordKeyupTime(now, event.key)
  }

  const handleSpace = () => {
    if (!testState.isActive || input.current === '') return

    const isWordCorrect = currentWord.value === input.current
    incrementAccuracy(isWordCorrect)
    wordInputs.value[testState.currentWordElementIndex] = input.current

    if (isWordCorrect) {
      pushToHistory()
      testState.incrementWordIndex()
      replayStore.addReplayEvent('submitCorrectWord')
    } else {
      pushMissedWordWithHistory(currentWord.value)
      testState.incrementWordIndex()
      replayStore.addReplayEvent('submitErrorWord')
      incrementKeypressErrors()
      pushToHistory()
    }
    incrementSpaces(isWordCorrect)

    //! What is it do? iDK
    incrementKeypressCount()
    //TODO: Move from here!
    if (testState.currentWordElementIndex === generator.retWords.words.length) {
      console.debug('test finished')
      testState.finish()
      return
    }
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
  }

  const clearAllInputData = () => {
    resetInput()
    corrected.current = ''
    corrected.history = []
    wordInputs.value = []
    resetCharacterCounts()
    resetAccuracy()
    resetAllErrors()
    resetKeypressTimings()
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
    replayStore.addReplayEvent('backWord')
  }
  //! What is it do?
  const incrementKeypressCount = () => {
    currentKeypressCount.value++
  }

  return {
    setCurrent,
    getCurrent,
    pushToHistory,
    missedWords,
    resetInput,
    input,
    getExtraLetters,
    backspaceToPrevious,
    handleSpace,
    getLetterClass,
    accuracy,
    accuracyPercentage,
    characterCounts,
    clearAllInputData,
    handleKeyDown,
    handleKeyUp,
    setWordToInput,
    handleInput,
    getStats,
    wordInputs
  }
})
