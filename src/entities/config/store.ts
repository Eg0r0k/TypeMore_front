import { LanguageObj } from '@/shared/constants/type'
import { applyTheme } from '@/shared/lib/hooks/useThemes'
import defaultConfig from '@shared/constants/default-config'

import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
//Config storage
export const useConfigStore = defineStore(
  'config',
  () => {
    //Get default config
    const config = reactive({
      ...defaultConfig
    })
    const currentLang = ref<LanguageObj>()

    const setLanguage = (lang: string) => {
      config.language = lang
    }

    const toggleFps = () => {
      config.showFps = !config.showFps
    }
    const setTheme = async (name: string) => {
      config.theme = name
      await applyTheme(name)
    }
    const setWords = (amount: number) => {
      config.words = amount
    }
    return { config, setLanguage, toggleFps, setTheme, setWords, currentLang }
  },
  //Saves config to local storage
  { persist: true }
)
