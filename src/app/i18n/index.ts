import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, getInitialLocale } from '@shared/lib/i18n/locale'
import en from './locales/en'
import ru from './locales/ru'

/**
 * Composition API mode (legacy: false) per vue-i18n v11 guidance.
 * English is the fallback: a key missing from another locale renders the
 * English string rather than the raw key path. Locale resolution itself lives
 * in `shared/lib/i18n/locale` so the config layer can reuse it.
 */
export const i18n = createI18n<false>({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, ru }
})
