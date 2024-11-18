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
import { useErrorHistory, useErrorTracking } from '@/shared/lib/hooks/useErrorTracking'
import { useAccuracyHandler } from '@/shared/lib/hooks/useAccuracyHandler'
import { useUIState } from '@/shared/lib/hooks/useUIState'
import { KAYS_TO_TRACK, MAX_OVERINCORRECT_LETTERS } from './const/keys'
import { roundTo2 } from '@/shared/lib/helpers/numbers'
import { useReplayStore } from '@/entities/replay/model/store'

type Keydata = {
  timestamp: number
  index: number
}

type KeypressTimings = {
  spacing: {
    first: number
    last: number
    array: number[]
  }
  duration: {
    array: number[]
  }
}
export const useInputStore = defineStore('input', () => {
  let keyDownData: Record<string, Keydata> = reactive({})
  let keypressTimings: KeypressTimings = reactive({
    spacing: { first: -1, last: -1, array: [] },
    duration: { array: [] }
  })
  let noCodeIndex = 0
  let keyOverlap = { total: 0, lastStartTime: -1 }
  const { accuracy, incrementAccuracy, resetAccuracy, accuracyPercentage } = useAccuracy()
  const currentWord = computed(() => generator.getCurrent())

  const { resetCharacterCounts, characterCounts, incrementCharacterCount } = useAccuracyHandler()
  const { missedWords, pushMissedWordWithHistory, resetAllErrors } = useErrorTracking()
  const { letterClasses, updateLetterClasses, getLetterClass } = useUIState()
  const { incrementKeypressErrors } = useErrorHistory()
  const wordInputs = ref<string[]>([])
  const currentKeypressCount = ref(0)
  const testState = useTestStateStore()
  const generator = markRaw(useWordGeneratorStore())
  const replayStore = useReplayStore()
  const {
    input,
    inputHistoryLength,
    inputLength,
    resetInput,

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
      console.log('incorrect')

      playErrorSound()
    }
  }
  function resetKeypressTimings(): void {
    keypressTimings = {
      spacing: {
        first: -1,
        last: -1,
        array: []
      },
      duration: {
        array: []
      }
    }
    keyOverlap = {
      total: 0,
      lastStartTime: -1
    }
    keyDownData = {}
    noCodeIndex = 0
    console.debug('Keypress timings reset')
  }
  function updateOverlap(now: number): void {
    const keys = Object.keys(keyDownData)
    if (keys.length > 1) {
      if (keyOverlap.lastStartTime === -1) {
        keyOverlap.lastStartTime = now
      }
    } else {
      if (keyOverlap.lastStartTime !== -1) {
        keyOverlap.total += now - keyOverlap.lastStartTime
        keyOverlap.lastStartTime = -1
      }
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

    const originalWord = generator.retWords.words[testState.currentWordElementIndex] || ''

    const maxLength = originalWord.length + MAX_OVERINCORRECT_LETTERS

    if (newValue.length > maxLength) {
      ;(event.target as HTMLInputElement).value = newValue.slice(0, maxLength)
      return
    }
    const charsToProcess = newValue.slice(oldValue.length).replace(' ', '')
    charsToProcess.split('').forEach((char, i) => handleChar(char, oldValue.length + i))

    input.current = newValue
    console.log(input.current)
    wordInputs.value[testState.currentWordElementIndex] = input.current
    console.log(wordInputs.value[testState.currentWordElementIndex])
    updateLetterClasses(testState.currentWordElementIndex, wordInputs.value)
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    const now = performance.now()
    recordKeydownTime(now, event.key)
    console.log(keyDownData, keypressTimings)
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    const now = performance.now()
    recordKeyupTime(now, event.key)
  }

  const recordKeyupTime = (now: number, key: string) => {
    // if (!KAYS_TO_TRACK.includes(key)) {
    //   console.debug('Key not tracked', key)
    //   return
    // }

    if (key === 'NoCode') {
      key = `NoCode${noCodeIndex--}`
    }

    const keyDownDataForKey = keyDownData[key]
    if (!keyDownDataForKey) return

    const diff = Math.abs(keyDownDataForKey.timestamp - now)
    keypressTimings.duration.array[keyDownDataForKey.index] = diff
    console.debug('Keyup recorded', key, diff)

    delete keyDownData[key]

    updateOverlap(now)
  }

  const recordKeydownTime = (now: number, key: string) => {
    // if (!KAYS_TO_TRACK.includes(key)) {
    //   console.debug('Key not tracked', key)
    //   return
    // }

    if (key === 'NoCode') {
      key = `NoCode${noCodeIndex++}`
    }

    if (keyDownData[key]) {
      console.debug('Key already down', key)
      return
    }

    keyDownData[key] = {
      timestamp: now,
      index: keypressTimings.duration.array.length
    }

    keypressTimings.duration.array.push(0)
    updateOverlap(now)

    if (keypressTimings.spacing.last !== -1) {
      const diff = Math.abs(now - keypressTimings.spacing.last)
      keypressTimings.spacing.array.push(roundTo2(diff))
      console.debug('Keydown recorded', key, diff)
    }

    if (keypressTimings.spacing.first === -1) {
      keypressTimings.spacing.first = now
      console.debug('First keydown recorded', key, now)
    }

    keypressTimings.spacing.last = now
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
      replayStore.addReplayEvent('submitCorrectWord')
    } else {
      characterCounts.value.incorrectSpaces++
      pushMissedWordWithHistory(currentWord.value)
      testState.incrementWordIndex()
      replayStore.addReplayEvent('submitErrorWord')
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
    resetInput()
    corrected.current = ''
    corrected.history = []
    wordInputs.value = []
    resetCharacterCounts()
    resetAccuracy()
    resetAllErrors()
    letterClasses.value = []
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
