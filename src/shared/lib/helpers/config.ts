import type { Config } from '@/shared/constants/type'
import { validateConfig } from './validation'
import defaultConfig from '@shared/constants/default-config'
import { reactive } from 'vue'
import logger from './logger'

export const configState = reactive<Config>({
  ...defaultConfig
})
export function setConfig<K extends keyof Config>(key: K, value: Config[K]): boolean {
  const validationResult = validateConfig(key, value)
  if (validationResult === true) {
    configState[key] = value
    return true
  }
  logger.error(`Validation failed for ${key}: ${validationResult}`)
  return false
}
