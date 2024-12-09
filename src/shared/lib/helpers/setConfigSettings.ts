import { ref } from 'vue'
import { useThemes } from '../hooks/useThemes'
import { LanguageObj } from '../types/types'
import { configState, setConfig } from './config'
import { getLanguage as getLanguageFromFile } from '@/shared/lib/helpers/json-files'
import { ConfigModes } from '@/shared/constants/type'

//TODO: Add validation for some func
export const setWords = (amount: number) => {
  setConfig('words', amount)
}

export const setTheme = async (name: string) => {
  const { applyTheme } = useThemes()
  configState.theme = name
  await applyTheme(name)
}
export const togglePlaySound = () => {
  configState.playSound = !configState.playSound
}
export const toggleFps = () => {
  configState.showFps = !configState.showFps
}
export const setMode = (mode: ConfigModes) => {
  console.log('Setting mode to:', mode)
  setConfig('mode', mode)
}
export const toggleKeyboard = () => {
  configState.showKeyboard = !configState.showKeyboard
}

export const currentLang = ref<LanguageObj | null>(null)

export const getLanguage = (): string => configState.language

export const setLanguage = async (lang: string): Promise<void> => {
  if (setConfig('language', lang)) {
    configState.language = lang
    try {
      const languageObj = await getLanguageFromFile(lang)
      currentLang.value = languageObj
    } catch (error) {
      console.error(`Error fetching language file for ${lang}:`, error)
    }
  }
}

export const setSoundVoulme = (volume: number) => {
  if (volume < 0) {
    volume = 0
  } else if (volume > 1.0) {
    volume = 1.0
  }
  setConfig('soundVolume', volume)
}

export const setFPS = (val: boolean) => {
  setConfig('showFps', val)
}

export const setFontFamily = (font: string) => {
  if (setConfig('fontFamily', font)) {
    configState.fontFamily = font
    const currentFont = getComputedStyle(document.documentElement).getPropertyValue('--font').trim()
    const fonts = currentFont.split(',').map((font) => font.trim())
    fonts[0] = font

    document.documentElement.style.setProperty('--font', fonts.join(', '))
  }
}

export const setTime = (val: number) => {
  setConfig('time', val)
}

export const setFontSize = (val: number) => {
  setConfig('fontSize', val)
}
