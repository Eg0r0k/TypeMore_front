import { useConfigStore } from '@/entities/config/model/store'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { useUiLanguage } from '@/shared/lib/hooks/useUiLanguage'
import { languagesQueryOptions } from '@shared/api'
import { useQuery } from '@tanstack/vue-query'
import { useFavicon } from '@vueuse/core'
import { LANG_KEY, THEMES_KEY } from '@/shared/constants/inject-keys'
import { computed, onBeforeMount, onMounted, onUnmounted, provide, ref } from 'vue'

export const useAppSetup = () => {
  const configStore = useConfigStore()
  const { applyTheme, themesList, themesOnUnmounted, favicon } = useThemes()
  // Locale follows the saved preference (or the browser under `system`) for the
  // whole app lifetime, not just while the settings dialog is mounted.
  useUiLanguage()
  const cookieOpen = ref(false)
  const { data: languages } = useQuery(languagesQueryOptions())
  const lang = computed(() => languages.value ?? [])

  provide(THEMES_KEY, themesList)
  provide(LANG_KEY, lang)

  onBeforeMount(async () => {
    await applyTheme(configStore.config.theme)
    document.querySelector('#app')?.classList.remove('hidden')
    useFavicon(favicon)
  })

  onMounted(() => {
    // Both setters paint a CSS variable; the persisted value is only half the
    // state until they run once at boot.
    configStore.setFontFamily(configStore.config.fontFamily)
    configStore.setFontSize(configStore.config.fontSize)
    try {
      if (!localStorage.getItem('cookieConsentGiven')) {
        cookieOpen.value = true
      }
    } catch (e) {
      console.error('Failed to get localstorage', e)
    }
  })

  onUnmounted(() => {
    themesOnUnmounted()
  })

  return { cookieOpen }
}
