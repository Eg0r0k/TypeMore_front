import { configState } from '@/shared/lib/helpers/config'
import { getLanguage } from '@/shared/lib/helpers/json-files'
import {
  currentLang,
  setFontFamily,
  setFontSize,
  setLanguage,
  setTheme,
  setWords,
  toggleFps
} from '@/shared/lib/helpers/setConfigSettings'

import { defineStore } from 'pinia'
import { computed } from 'vue'

/**
 *
 */
export const useConfigStore = defineStore(
  'config',
  () => {
    const setMode = (mode: 'words' | 'free' | 'time') => {
      configState.mode = mode
    }
    const currentLanguage = computed(() => currentLang)

    return {
      config: configState,
      setLanguage,
      toggleFps,
      setFontFamily,
      setTheme,
      setWords,
      currentLang,
      getLanguage,
      setFontSize,
      currentLanguage,
      setMode
    }
  },
  {
    persist: {
      storage: localStorage,
      key: 'config',
      serializer: {
        serialize: (store) => {
          return JSON.stringify({
            config: store.config
          })
        },
        deserialize: (data) => {
          const parsedData = JSON.parse(data)
          return {
            config: parsedData.config
          }
        }
      }
    }
  }
)
