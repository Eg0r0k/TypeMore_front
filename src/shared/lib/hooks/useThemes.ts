import { Theme } from '@/features/modal/themes/types/themes'
import { cachedFetchJson } from '../helpers/json-files'
import { computed, onMounted, onUnmounted, reactive, ref, watchEffect } from 'vue'
import { useTestStateStore } from '@/entities/test'

const root = document.documentElement
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

const defaultTheme: Theme = {
  name: 'default',
  '--bg-color': '#121212',
  '--text-color': '#eeeeee',
  '--error-color': '#da3333',
  '--main-color': '#528bff',
  '--sub-color': '#3a3a3a',
  '--sub-alt-color': '#1c1c1c',
  '--error-extra-color': '#791717'
} as const
type CSSVariable = (typeof cssVariables)[number]
export function useThemes() {
  const themesList = reactive<Theme[]>([])
  const refColors = reactive<Record<CSSVariable, string>>({} as Record<CSSVariable, string>)

  const updateRefColors = () => {
    const computedStyle = getComputedStyle(root)
    cssVariables.forEach((variable) => {
      refColors[variable] = computedStyle.getPropertyValue(variable)
    })
  }
  const styleObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        updateRefColors()
      }
    })
  })
  watchEffect(() => {
    updateRefColors()
  })

  const fetchThemes = async (): Promise<Theme[]> => {
    const themes = await cachedFetchJson<Theme[]>('./static/themes/themes.json')
    themesList.splice(0, themesList.length, ...themes.sort((a, b) => a.name.localeCompare(b.name)))
    return themesList
  }
  const applyColor = (theme: Theme) => {
    Object.entries(theme).forEach(([key, val]) => {
      root.style.setProperty(key, val)
    })
  }
  const useConfigTheme = async (name: string): Promise<Theme> => {
    await fetchThemes()
    return themesList.find((theme) => theme.name === name) || defaultTheme
  }
  const currentTheme = computed(() => {
    return (
      themesList.find((theme) => theme.name === localStorage.getItem('themeName')) || defaultTheme
    )
  })
  const applyTheme = async (name: string): Promise<void> => {
    const testState = useTestStateStore()
    const theme = await useConfigTheme(name)
    applyColor(theme)
    localStorage.setItem('themeName', name)

   
    testState.setLoading(false)
  }
  onMounted(() => {
    styleObserver.observe(root, {
      attributes: true,
      attributeFilter: ['style']
    })
  })
  onUnmounted(() => {
    styleObserver.disconnect()
  })
  return {
    themesList,
    refColors,
    applyTheme,
    fetchThemes,
    useConfigTheme,
    currentTheme
  }
}
