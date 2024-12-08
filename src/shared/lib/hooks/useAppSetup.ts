import { useConfigStore } from '@/entities/config/model/store'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { getLangList } from '@/shared/lib/helpers/json-files'
import { useFavicon } from '@vueuse/core'
import { CookieModal } from '@/features/modal/cookie'
import { useModal } from '@/entities/modal/model/store'
import { LANG_KEY, THEMES_KEY } from '@/shared/constants/inject-keys'
import { onBeforeMount, onMounted, onUnmounted, provide, ref } from 'vue'

export const useAppSetup = () => {
  const configStore = useConfigStore()
  const { applyTheme, themesList, themesOnUnmounted, favicon } = useThemes()
  const modalStore = useModal()
  const lang = ref()

  provide(THEMES_KEY, themesList)
  provide(LANG_KEY, lang)

  onBeforeMount(async () => {
    await applyTheme(configStore.config.theme)
    document.querySelector('#app')?.classList.remove('hidden')
    useFavicon(favicon)
  })

  onMounted(async () => {
    lang.value = await getLangList()
    configStore.setFontFamily(configStore.config.fontFamily)
    try {
      if (!localStorage.getItem('cookieConsentGiven')) {
        modalStore.open(CookieModal, 'bottom', 'right', false)
      }
    } catch (e) {
      console.error('Failed to get localstorage', e)
    }
  })

  onUnmounted(() => {
    themesOnUnmounted()
  })
}
