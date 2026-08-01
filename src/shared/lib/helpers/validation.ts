import type { Config } from '@/shared/constants/type'
import { isSupportedLocale } from '@/shared/lib/i18n/locale'
import { SOUND_PACKS } from '@/shared/constants/sound-packs'

type ValidatorFn = (value: unknown) => boolean | string

const validators: Record<keyof Config, ValidatorFn> = {
  //TODO: Dont forget make infiniy mode
  words: (value) =>
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10000) ||
    'Words must be a positive integer',
  //TODO: Dont forget make infiniy mode
  time: (value) =>
    (typeof value === 'number' && Number.isInteger(value) && value > 0) ||
    'Time must be a non-negative integer',
  devTools: (value) => typeof value === 'boolean' || 'Show devtools must be boolean',
  language: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Language must be a non-empty string',
  uiLanguage: (value) =>
    value === 'system' ||
    (typeof value === 'string' && isSupportedLocale(value)) ||
    'Unsupported interface language',

  playSound: (value) => typeof value === 'boolean' || 'Play sound must be a boolean',
  theme: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Theme must be a non-empty string',
  mode: (value) => {
    if (typeof value === 'string' && ['words', 'free', 'time', 'quote'].includes(value)) {
      return true
    }
    return 'Invalid mode selected'
  },
  showKeyboard: (value) => typeof value === 'boolean' || 'Play sound must be a boolean',
  backgroundImg: (value) => {
    if (typeof value !== 'string') return 'Background image must be a string'
    // '' clears the custom background — the only way back to the theme colour.
    if (value.length === 0) return true
    const urlPattern = /^(https?:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.webp|\.svg))$/i
    return (
      urlPattern.test(value) || 'Background image must be a valid URL pointing to an image file'
    )
  },
  backgroundLocal: (value) =>
    (typeof value === 'string' && (value.length === 0 || value.startsWith('data:image/'))) ||
    'Local background must be an image data URL',
  backgroundSize: (value) =>
    (typeof value === 'string' && ['cover', 'contain', 'max'].includes(value)) ||
    'Invalid background size',
  showFps: (value) => typeof value === 'boolean' || 'Show FPS must be a boolean',
  soundVolume: (value) =>
    (typeof value === 'number' && value >= 0 && value <= 1.0) ||
    'Sound volume must be between 0 and 1.0',
  soundSet: (value) =>
    (typeof value === 'string' && SOUND_PACKS.some((pack) => pack.id === value)) ||
    'Invalid sound set',
  fontSize: (value) =>
    (typeof value === 'number' && value > 0) || 'Font size must be a positive number',
  fontFamily: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Font family must be a non-empty string',
  punctuation: (value) => typeof value === 'boolean' || 'Punctuation must be a boolean',
  numbers: (value) => typeof value === 'boolean' || 'Numbers must be a boolean',
  randomCase: (value) => typeof value === 'boolean' || 'Random case must be a boolean',
  nospace: (value) => typeof value === 'boolean' || 'No-space must be a boolean',
  difficulty: (value) =>
    (typeof value === 'string' && ['normal', 'expert', 'master'].includes(value)) ||
    'Invalid difficulty',
  blind: (value) => typeof value === 'boolean' || 'Blind must be a boolean',
  reverse: (value) => typeof value === 'boolean' || 'Reverse must be a boolean',
  lazy: (value) => typeof value === 'boolean' || 'Lazy mode must be a boolean',
  quoteGroup: (value) =>
    (typeof value === 'string' && ['all', 'short', 'medium', 'long', 'thicc'].includes(value)) ||
    'Invalid quote length',
  minWpm: (value) =>
    (typeof value === 'number' && [0, 60, 80, 100].includes(value)) ||
    'MinSpeed must be 0, 60, 80 or 100',
  fading: (value) => typeof value === 'boolean' || 'Fading must be a boolean',
  flashlight: (value) => typeof value === 'boolean' || 'Flashlight must be a boolean',
  freedomMode: (value) => typeof value === 'boolean' || 'Freedom mode must be a boolean',
  stopOnError: (value) =>
    (typeof value === 'string' && ['off', 'word', 'letter'].includes(value)) ||
    'Invalid stop on error',
  quickEnd: (value) => typeof value === 'boolean' || 'Quick end must be a boolean',
  smoothCaret: (value) =>
    (typeof value === 'string' && ['off', 'slow', 'medium', 'fast'].includes(value)) ||
    'Invalid smooth caret',
  caretStyle: (value) =>
    (typeof value === 'string' &&
      ['off', 'default', 'block', 'outline', 'underline'].includes(value)) ||
    'Invalid caret style',
  paceCaret: (value) =>
    (typeof value === 'string' && ['off', 'pb', 'last', 'avg', 'custom'].includes(value)) ||
    'Invalid pace caret mode',
  paceCaretWpm: (value) =>
    (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000) ||
    'Pace caret speed must be an integer between 1 and 1000 wpm'
}
export const validateConfig = (key: keyof Config, value: unknown): boolean | string => {
  const validator = validators[key]

  return validator ? validator(value) : true
}

export const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const usernameReg = new RegExp(/^[a-zA-Z0-9_-]+$/)
export const upperCaseReg = new RegExp(/[a-z]/)
export const lowerCaseReg = new RegExp(/[A-Z]/)
export const containNumberReg = new RegExp(/\d/)
export const passwordReg = /^[a-zA-Z0-9!@#$%^&*(),.?":{}|<>]+$/
export const isValidUrl = (href: string): boolean => {
  try {
    new URL(href, window.location.origin)
    return true
  } catch {
    return false
  }
}
