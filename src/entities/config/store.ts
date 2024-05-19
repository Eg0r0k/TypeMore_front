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
  return { config, setLanguage, toggleFps }
})
