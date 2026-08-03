import { useConfigStore } from '@/entities/config'
import { useDialogsStore } from '@/entities/dialogs'
import { useRootClass } from '@/shared/lib/hooks/useRootClass'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { useUiLanguage } from '@/shared/lib/hooks/useUiLanguage'
import { useFavicon } from '@vueuse/core'
import { THEMES_KEY } from '@/shared/constants/inject-keys'
import { onBeforeMount, onMounted, provide } from 'vue'
import logger from '@/shared/lib/helpers/logger'

export const useAppSetup = () => {
  // Environment classes on <html> (scroll mode, browser, OS) — the scrollable
  // styles are inert until these are stamped.
  useRootClass()

  const configStore = useConfigStore()
  // The themes hook disconnects its own observer on scope dispose.
  const { applyTheme, themesList, favicon } = useThemes()
  // Locale follows the saved preference (or the browser under `system`) for the
  // whole app lifetime, not just while the settings dialog is mounted.
  useUiLanguage()
  // The cookie notice is one of the app-level dialogs App.vue mounts; this only
  // decides whether the first-visit gate goes up.
  const dialogs = useDialogsStore()

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
        dialogs.requireCookieConsent()
      }
    } catch (e) {
      logger.error('Failed to get localstorage', e)
    }
  })
}
