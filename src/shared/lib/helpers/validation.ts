import { Config } from '@/shared/constants/type'

type ValidatorFn = (value: any) => boolean | string

const validators: Record<keyof Config, ValidatorFn> = {
  words: (value) => (Number.isInteger(value) && value > 0) || 'Words must be a positive integer',
  time: (value) => (Number.isInteger(value) && value >= 0) || 'Time must be a non-negative integer',
  devTools: (value) => typeof value === 'boolean' || 'Show devtools must be boolean',
  language: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Language must be a non-empty string',

  playSound: (value) => typeof value === 'boolean' || 'Play sound must be a boolean',
  theme: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Theme must be a non-empty string',
  mode: (value) => {
    if (['words', 'free', 'time'].includes(value)) {
      return true
    }
    return 'Invalid mode selected'
  },
  showKeyboard: (value) => typeof value === 'boolean' || 'Play sound must be a boolean',
  backgroundImg: (value) => {
    if (typeof value === 'string' && value.length > 0) {
      const urlPattern = /^(https?:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.webp|\.svg))$/i
      return (
        urlPattern.test(value) || 'Background image must be a valid URL pointing to an image file'
      )
    }
    return 'Background image must be a non-empty string'
  },
  showFps: (value) => typeof value === 'boolean' || 'Show FPS must be a boolean',
  soundVolume: (value) =>
    (typeof value === 'number' && value >= 0 && value <= 1.0) ||
    'Sound volume must be between 0 and 1.0',
  fontSize: (value) =>
    (typeof value === 'number' && value > 0) || 'Font size must be a positive number',
  fontFamily: (value) =>
    (typeof value === 'string' && value.length > 0) || 'Font family must be a non-empty string'
}
export const validateConfig = (key: keyof Config, value: any): boolean | string => {
  const validator = validators[key]

  return validator ? validator(value) : true
}

export const emailReg = new RegExp(
  /^(([^<>()[]+(\.[^<>()[]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
)
