import { defineStore } from 'pinia'
import { ref } from 'vue'
// Store for control test state
export const useTestStateStore = defineStore('test-state', () => {
  const isActive = ref(false)
  const isRepeated = ref(false)
  const isLoading = ref(true)
  const currentWordElementIndex = ref(0)
  const reset = () => {
    currentWordElementIndex.value = 0
  }
  const setActive = (value: boolean): void => {
    isActive.value = value
  }
  const setRepeated = (value: boolean): void => {
    isRepeated.value = value
  }
  const setLoading = (value: boolean): void => {
    isLoading.value = value
  }
  const setCurrentWordElementIndex = (value: number): void => {
    currentWordElementIndex.value = value
  }
  return {
    setActive,
    setRepeated,
    isActive,
    isRepeated,
    setLoading,
    isLoading,
    reset,
    setCurrentWordElementIndex,
    currentWordElementIndex
  }
})
