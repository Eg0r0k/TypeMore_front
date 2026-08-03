import { ref } from 'vue'
import { useThemes } from '../hooks/useThemes'
import { loadDictionaryBody, type DictionaryBody } from '@shared/api'
import { configState, setConfig } from './config'
import { ConfigModes } from '@/shared/constants/type'
import defaultConfig from '@/shared/constants/default-config'
import logger from './logger'

//TODO: Add validation for some func
export const setWords = (amount: number) => {
  setConfig('words', amount)
}

export const setTheme = async (name: string) => {
  const { applyTheme } = useThemes()
  configState.theme = name
  await applyTheme(name)
}
export const setMode = (mode: ConfigModes) => {
  setConfig('mode', mode)
}

export const currentLang = ref<DictionaryBody | null>(null)

export const setLanguage = async (lang: string): Promise<void> => {
  if (setConfig('language', lang)) {
    configState.language = lang
    try {
      const languageObj = await loadDictionaryBody(lang)
      currentLang.value = languageObj
    } catch (error) {
      logger.error(`Error fetching language file for ${lang}:`, error)
    }
  }
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

/**
 * Test-text size. The words render inside the field's shadow root, which reads
 * `--tm-font-size` — custom properties inherit through the shadow boundary, so
 * setting it on the root element is all the plumbing there is.
 */
export const setFontSize = (val: number) => {
  if (setConfig('fontSize', val)) {
    document.documentElement.style.setProperty('--tm-font-size', `${val}px`)
  }
}

/**
 * Back to factory defaults. Assigning the plain object is not enough: the
 * values that live as CSS variables (font family/size) and the theme have to be
 * re-applied, exactly as the boot sequence does.
 */
export const resetSettings = async (): Promise<void> => {
  Object.assign(configState, defaultConfig)
  setFontFamily(defaultConfig.fontFamily)
  setFontSize(defaultConfig.fontSize)
  await setTheme(defaultConfig.theme)
}
