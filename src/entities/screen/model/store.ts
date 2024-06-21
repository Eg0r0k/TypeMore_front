import { ref } from 'vue'
import { defineStore } from 'pinia'
import { type Platform } from './types/types'

export const useScreenStore = defineStore('screen', () => {
  const platform = ref<Platform>('desktop')
  //set platform based on screen width
  const setPlatform = (width: number): Platform => {
    if (width >= 1024) return (platform.value = 'desktop')
    if (width >= 768) return (platform.value = 'tablet')
    return (platform.value = 'mobile')
  }
  return { setPlatform, platform }
})
