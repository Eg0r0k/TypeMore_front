import { useConfigStore } from '@/entities/config'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { useUiLanguage } from '@/shared/lib/hooks/useUiLanguage'
import { useFavicon } from '@vueuse/core'
import { THEMES_KEY } from '@/shared/constants/inject-keys'
import { onBeforeMount, onMounted, provide, ref } from 'vue'
import logger from '@/shared/lib/helpers/logger'

export const useAppSetup = () => {
  const configStore = useConfigStore()
  // The themes hook disconnects its own observer on scope dispose.
  const { applyTheme, themesList, favicon } = useThemes()
  // Locale follows the saved preference (or the browser under `system`) for the
  // whole app lifetime, not just while the settings dialog is mounted.
  useUiLanguage()
  const cookieOpen = ref(false)

  provide(THEMES_KEY, themesList)

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
      logger.error('Failed to get localstorage', e)
    }
  })

  return { cookieOpen }
}
