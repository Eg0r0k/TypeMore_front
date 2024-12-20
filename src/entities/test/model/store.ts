import { useConfigStore } from '@/entities/config/model/store'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@entities/input/model/store'
import { useReplayStore } from '@/entities/replay/model/store'
import { useTimerStore } from '@/entities/timer/model/store'

import { defineStore } from 'pinia'
import { ref } from 'vue'
/**
 * Store for controlling the test state.
 * It manages the test activity, repetition status, loading state,
 * and the current word index during the test.
 */
export const useTestStateStore = defineStore('test-state', () => {
  const isActive = ref(false)
  const isRepeated = ref(false)
  const isLoading = ref(true)
  //! Not here
  const isRightToLeft = ref(false)
  const currentWordElementIndex = ref(0)

  const inputStore = useInputStore()
  const replayStore = useReplayStore()
  const timerStore = useTimerStore()
  const configStore = useConfigStore()
  const generator = useWordGeneratorStore()

  /**
   * Initializes the test state by setting the active state to true, starting the timer, and generating words.
   * If the current language is not set, it sets the language to Russian and calls itself recursively.
   * @returns {Promise<void>} - Promise that resolves when the test is initialized.
   */
  const init = async () => {
    clear()
    setActive(true)
    timerStore.startTimer()

    try {
      const lang = configStore.config.language
      await configStore.setLanguage(lang)
    } catch (e) {
      console.error('Error setting language:', e)
    }

    if (!configStore.currentLanguage.value) {
      console.warn('Language not set, retrying...')
      await retrySetLanguage('russian', 3)
    }

    if (configStore.currentLanguage.value) {
      try {
        await generator.generateWords(configStore.currentLanguage.value)
        isRightToLeft.value = !!configStore.currentLanguage.value.rightToleft
      } catch (e) {
        console.error('Error generating words:', e)
      }
    } else {
      console.error('Language is not set, cannot generate words.')
    }
  }
  /**
   * Retries setting the language with a delay
   * @param lang - The language to set
   * @param retriesLeft - The number of retries left
   * @returns {Promise<void>} - Promise that resolves when the language is set
   */
  const retrySetLanguage = async (lang: string, retriesLeft: number): Promise<void> => {
    if (retriesLeft <= 0) {
      console.error('Failed to set language after multiple retries.')
      return
    }

    try {
      await configStore.setLanguage(lang)
    } catch (e) {
      console.error('Error setting language:', e)
    }

    if (!configStore.currentLanguage.value) {
      console.warn(`Retrying language set (${retriesLeft - 1} retries left)...`)
      await new Promise((resolve) => setTimeout(resolve, 250))
      await retrySetLanguage(lang, retriesLeft - 1)
    }
  }

  /**
   * Clears the test state, resetting the current word index to 0 and clearing input data and timer.
   */
  const clear = () => {
    reset()
    inputStore.clearAllInputData()
    timerStore.resetTimer()
  }
  /**
   * Finishes the test, saving the replay data.
   * Stops the timer, sets the active state to false, and saves the current input history to the replay store.
   * @returns {Promise<void>} - Promise that resolves when the test is finished.
   */
  const finish = async () => {
    if (!isActive.value) return
    const now = performance.now()
    console.log('Finish', now)
    timerStore.stopTimer()
    isActive.value = false

    console.log('Finish Replay')
    replayStore.replayGetWordsList(inputStore.input.history)
  }

  const restartTest = async (): Promise<void> => {
    console.log('restart')
    await init()
  }

  /**
   * Resets the current word index to 0.
   */
  const reset = () => {
    currentWordElementIndex.value = 0
  }

  const incrementWordIndex = () => {
    currentWordElementIndex.value++
  }
  const decrementWordIndex = () => {
    currentWordElementIndex.value--
  }
  /**
   * Sets the active state of the test.
   * @param value - Whether the test is active or not.
   */
  const setActive = (value: boolean): void => {
    isActive.value = value
  }
  /**
   * Sets the repeated state of the test (if it's a repeated session).
   * @param value - Whether the test is being repeated or not.
   */
  const setRepeated = (value: boolean): void => {
    isRepeated.value = value
  }
  /**
   * Sets the loading state of the test.
   * @param value - Whether the test is loading or not.
   */
  const setLoading = (value: boolean): void => {
    isLoading.value = value
  }
  /**
   * Sets the current word index to a specific value.
   * @param value - The number to set as the current word index.
   */
  const setCurrentWordElementIndex = (value: number): void => {
    currentWordElementIndex.value = value
  }

  return {
    setActive,
    restartTest,
    isRightToLeft,
    finish,
    setRepeated,
    clear,
    isActive,
    init,
    decrementWordIndex,
    isRepeated,
    setLoading,
    isLoading,
    reset,
    setCurrentWordElementIndex,
    currentWordElementIndex,
    incrementWordIndex
  }
})
