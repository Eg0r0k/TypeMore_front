import { configState, setConfig } from '@/shared/lib/helpers/config'
import { getLanguage } from '@/shared/lib/helpers/json-files'
import {
  currentLang,
  setFontFamily,
  setFontSize,
  setFPS,
  setLanguage,
  setMode,
  setTheme,
  setWords,
  toggleFps,
  toggleKeyboard,
  togglePlaySound
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
      toggleKeyboard,
      config: configState,
      togglePlaySound,
      setLanguage,
      toggleFps,
      setFontFamily,
      setTheme,
      setWords,
      setFPS,
      currentLang,
      setConfig,
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
