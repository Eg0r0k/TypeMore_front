import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTestStateStore = defineStore('test-state', () => {
  const isActive = ref(false)
  const isRepeated = ref(false)
  const setActive = (value: boolean) => {
    isActive.value = value
  }
  const setRepeated = (value: boolean) => {
    isRepeated.value = value
  }

  return { setActive, setRepeated, isActive, isRepeated }
})
