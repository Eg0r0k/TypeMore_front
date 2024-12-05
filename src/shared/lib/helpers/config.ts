import { Config } from '@/shared/constants/type'
import { validateConfig } from './validation'
import defaultConfig from '@shared/constants/default-config'
import { reactive } from 'vue'

export const configState = reactive<Config>({
  ...defaultConfig
})
export function setConfig<K extends keyof Config>(key: K, value: Config[K]): boolean {
  console.log('Validating key:', key, 'with value:', value)
  const validationResult = validateConfig(key, value)
  console.log('Validation result:', validationResult)
  if (validationResult === true) {
    configState[key] = value
    return true
  } else {
    console.error(`Validation failed for ${key}: ${validationResult}`)
    return false
  }
}
