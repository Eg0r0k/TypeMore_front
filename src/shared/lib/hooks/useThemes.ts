import { Theme } from '@/features/modal/theme/types/themes'
import { cachedFetchJson } from '../helpers/json-files'
import { ref } from 'vue'
import { useConfigStore } from '@/entities/config/store'
import { useTestStateStore } from '@/entities/test'

//Array of themes
export const themesList = ref<Theme[]>([])
const cssVariables = [
  '--bg-color',
  '--text-color',
  '--error-color',
  '--main-color',
  '--sub-color',
  '--sub-alt-color',
  '--error-extra-color'
] as const
type CSSVariable = (typeof cssVariables)[number]

export const refColors = ref<Record<CSSVariable, string>>({} as Record<CSSVariable, string>)

const updateRefColors = () => {
  const computedStyle = getComputedStyle(document.documentElement)
  cssVariables.forEach((variable) => {
    refColors.value[variable] = computedStyle.getPropertyValue(variable)
  })
}

const styleObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
      updateRefColors()
    }
  })
})

styleObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['style']
})

const defaultTheme: Theme = {
  name: 'default',
  '--bg-color': '#121212',
  '--text-color': '#eeeeee',
  '--error-color': '#da3333',
  '--main-color': '#528bff',
  '--sub-color': '#3a3a3a',
  '--sub-alt-color': '#1c1c1c',
  '--error-extra-color': '#791717'
}
const root = document.documentElement
//Get themes from json file
export const fetchThemes = async (): Promise<Theme[]> => {
  const themes = await cachedFetchJson<Theme[]>('./static/themes/themes.json')
  themesList.value = themes.sort((a, b) => a.name.localeCompare(b.name))
  return themesList.value
}
//Apply colors from theme to :root
export const applyColor = (theme: Theme) => {
  Object.entries(theme).forEach(([key, val]) => {
    root.style.setProperty(key, val)
  })
}
// Hook to set theme if theme not exist set default theme
export const useConfigTheme = async (name: string): Promise<Theme> => {
  await fetchThemes()
  const savedTheme = name
  const foundTheme = themesList.value.find((theme) => theme.name === savedTheme)
  return foundTheme || defaultTheme
}

export const applyTheme = async (name: string): Promise<void> => {
  const testState = useTestStateStore()
  const theme = await useConfigTheme(name)
  applyColor(theme)
  const configStore = useConfigStore()
  configStore.setTheme(theme.name)
  testState.setLoading(false)
}
