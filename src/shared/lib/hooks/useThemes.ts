import { Theme } from '@/features/modal/themes/types/themes'
import { cachedFetchJson } from '../helpers/json-files'
import { computed, reactive, watchEffect } from 'vue'
import { useTestStateStore } from '@/entities/test'
import { useConfigStore } from '@/entities/config/model/store'

const root = document.documentElement
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
/**
 * Provides theme management functionality, including fetching themes, applying themes, and observing style changes.
 *
 * @returns An object containing reactive properties and methods for theme management.
 */
export function useThemes() {
  const themesList = reactive<Theme[]>([])
  const refColors = reactive<Record<CSSVariable, string>>({} as Record<CSSVariable, string>)
  const configStore = useConfigStore()

  /**
   * Updates the reactive reference colors based on the current CSS variables.
   */
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
  /**
   * Fetches themes from a JSON file and sorts them by name.
   *
   * @returns A promise that resolves to a list of themes.
   */
  const fetchThemes = async (): Promise<Theme[]> => {
    const themes = await cachedFetchJson<Theme[]>('./static/themes/themes.json')
    themesList.splice(0, themesList.length, ...themes.sort((a, b) => a.name.localeCompare(b.name)))
    return themesList
  }
  /**
   * Applies a theme by setting the CSS variables on the document root.
   *
   * @param theme - The theme to apply.
   */
  const applyColor = (theme: Theme): void => {
    Object.entries(theme).forEach(([key, val]) => {
      root.style.setProperty(key, val)
    })
  }
  /**
   * Fetches and returns a theme by name from the configuration, or returns the default theme if not found.
   * 
   * @param name - The name of the theme to fetch.
   * @returns A promise that resolves to the fetched or default theme.
   */
  const useConfigTheme = async (name: string): Promise<Theme> => {
    await fetchThemes()
    return themesList.find((theme) => theme.name === name) || defaultTheme
  }

  const currentTheme = computed(() => {
    return themesList.find((theme) => theme.name === configStore.config.theme) || defaultTheme
  })
  /**
   * Applies a theme based on its name and updates the test state loading status.
   * 
   * @param name - The name of the theme to apply.
   *  @returns A promise that resolves when the theme is applied.
   */
  const applyTheme = async (name: string): Promise<void> => {
    const testState = useTestStateStore()
    const theme = await useConfigTheme(name)
    applyColor(theme)

    testState.setLoading(false)
  }

  styleObserver.observe(root, {
    attributes: true,
    attributeFilter: ['style']
  })
  /**
   * Disconnects the style observer when the component is unmounted.
   */
  const themesOnUnmounted = () => {
    styleObserver.disconnect()
  }

  return {
    themesList,
    refColors,
    applyTheme,
    fetchThemes,
    useConfigTheme,
    currentTheme,
    themesOnUnmounted
  }
}
