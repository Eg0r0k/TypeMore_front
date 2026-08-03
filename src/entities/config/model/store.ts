import { configState, setConfig } from '@/shared/lib/helpers/config'
import {
  currentLang,
  resetSettings,
  setFontFamily,
  setFontSize,
  setLanguage,
  setMode,
  setTheme,
  setTime,
  setWords
} from '@/shared/lib/helpers/setConfigSettings'

import { defineStore } from 'pinia'
import { computed } from 'vue'

/**
 *
 */
export const useConfigStore = defineStore(
  'config',
  () => {
    const currentLanguage = computed(() => currentLang)

    return {
      config: configState,
      setTime,
      setLanguage,
      setFontFamily,
      setTheme,
      setWords,
      currentLang,
      setConfig,
      setFontSize,
      resetSettings,
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
