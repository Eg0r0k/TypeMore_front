import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useScreenStore = defineStore('screen', () => {
  // App-level loading (theme bootstrap); moved off the old game store.
  const isLoading = ref(true)
  const setLoading = (value: boolean): void => {
    isLoading.value = value
  }
  return { isLoading, setLoading }
})
