import { Config } from '@/shared/constants/type'
import { getLanguage as getLanguageFromFile } from '@/shared/lib/helpers/json-files'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { LanguageObj } from '@/shared/lib/types/types'
import defaultConfig from '@shared/constants/default-config'

import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
/**
 *
 */
export const useConfigStore = defineStore(
  'config',
  () => {
    const config = reactive<Config>({
      ...defaultConfig
    })
    const currentLang = ref<LanguageObj>()
    const getLanguage = (): string => config.language
    const setLanguage = async (lang: string): Promise<void> => {
      config.language = lang
      try {
        const languageObj = await getLanguageFromFile(lang)
        currentLang.value = languageObj
      } catch (error) {
        console.error(`Error fetching language file for ${lang}:`, error)
      }
    }
    const setFontSize = (val: number) => {
      config.fontSize = val
    }
    const toggleFps = () => {
      config.showFps = !config.showFps
    }
    const setTheme = async (name: string) => {
      const { applyTheme } = useThemes()
      config.theme = name
      await applyTheme(name)
    }
    const setWords = (amount: number) => {
      config.words = amount
    }
    return {
      config,
      setLanguage,
      toggleFps,
      setTheme,
      setWords,
      currentLang,
      getLanguage,
      setFontSize
    }
  },
  //Saves only config to local storage
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
