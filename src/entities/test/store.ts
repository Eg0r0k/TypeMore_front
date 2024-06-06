import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTestStateStore = defineStore('test-state', () => {
  const isActive = ref(false)
  const isRepeated = ref(false)
  const isLoading = ref(true)
  const setActive = (value: boolean) => {
    isActive.value = value
  }
  const setRepeated = (value: boolean) => {
    isRepeated.value = value
  }
  const setLoading = (value: boolean) => {
    isLoading.value = value
  }
  return { setActive, setRepeated, isActive, isRepeated, setLoading, isLoading }
})
