import defaultConfig from '@shared/constants/default-config'

import { defineStore } from 'pinia'
import { reactive } from 'vue'
//Config storage
export const useConfigStore = defineStore(
  'config',
  () => {
    //Get default config
    const config = reactive({
      ...defaultConfig
    })

    const setLanguage = (lang: string) => {
      config.language = lang
    }

    const toggleFps = () => {
      config.showFps = !config.showFps
    }

    const setTheme = (name: string) => {
      config.theme = name
    }
    const setWords = (amount: number) => {
      config.words = amount
    }
    return { config, setLanguage, toggleFps, setTheme, setWords }
  },
  //Saves config to local storage
  { persist: true }
)
