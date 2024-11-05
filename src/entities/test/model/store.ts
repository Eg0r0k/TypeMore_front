import { useInputStore } from '@/entities/input/model'
import { useReplayStore } from '@/entities/replay/model/store'

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
  const inputStore = useInputStore()
  const replayStore = useReplayStore()
  const currentWordElementIndex = ref(0)
  const currentTestLine = ref(0)
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

  /**
   * Finishes the test by setting the active state to false.
   */
  const finish = async () => {
    if (!isActive.value) return
    const now = performance.now()
    console.log('Finish', now)
    isActive.value = false

    console.log('Finish Replay')
    replayStore.replayGetWordsList(inputStore.input.history) 
  }
  return {
    setActive,
    finish,
    setRepeated,
    isActive,
    decrementWordIndex,
    isRepeated,
    setLoading,
    isLoading,
    reset,
    setCurrentWordElementIndex,
    currentWordElementIndex,
    incrementWordIndex,
    currentTestLine
  }
})
