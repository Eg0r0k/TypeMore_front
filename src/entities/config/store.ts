import defaultConfig from '@shared/constants/default-config'

import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useConfigStore = defineStore('config', () => {
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
  return { config, setLanguage, toggleFps, setTheme }
})
