import { configState } from '@/shared/lib/helpers/config'
import { getLanguage, getLanguage as getLanguageFromFile } from '@/shared/lib/helpers/json-files'
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

/**
 *
 */
export const useConfigStore = defineStore(
  'config',
  () => {
    return {
      config: configState,
      setLanguage,
      toggleFps,
      setFontFamily,
      setTheme,
      setWords,
      currentLang,
      getLanguage,
      setFontSize
    }
  },
  {
    persist: {
      storage: localStorage,
      paths: ['config'],
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
