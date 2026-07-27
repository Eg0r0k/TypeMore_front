import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNavigatorLanguage } from '@vueuse/core'

import { useConfigStore } from '@/entities/config'
import {
  DEFAULT_LOCALE,
  getBrowserLocale,
  type Locale,
  type UiLanguage
} from '@/shared/lib/i18n/locale'

/**
 * Keeps the rendered locale in sync with `config.uiLanguage`.
 *
 * `system` is not a locale — it is a subscription to the browser: the effective
 * locale is recomputed whenever `navigator.language` changes (a user switching
 * their OS/browser language mid-session), and the boot value in `createI18n`
 * resolves the same way from localStorage.
 */
export const useUiLanguage = () => {
  const { locale } = useI18n()
  const configStore = useConfigStore()
  const { language: browserLanguage } = useNavigatorLanguage()

  const language = computed<UiLanguage>(() => configStore.config.uiLanguage)

  const effective = computed<Locale>(() =>
    language.value === 'system'
      ? (getBrowserLocale(browserLanguage.value) ?? DEFAULT_LOCALE)
      : language.value
  )

  watch(
    effective,
    (next) => {
      locale.value = next
      document.documentElement.lang = next
    },
    { immediate: true }
  )

  return {
    language,
    effective,
    setLanguage: (next: UiLanguage) => configStore.setConfig('uiLanguage', next)
  }
}
