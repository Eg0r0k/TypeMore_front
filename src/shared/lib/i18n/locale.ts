/**
 * Locale resolution, mirroring the approach used in Audiogram: the saved
 * preference wins, `system` (and no preference at all) follows the browser, and
 * anything unsupported falls back to English.
 *
 * This module runs BEFORE the app (it seeds `createI18n`), so it must not touch
 * Pinia — the persisted config is read straight out of localStorage.
 */
export const SUPPORTED_LOCALES = ['en', 'ru'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** `system` means "whatever the browser reports", re-evaluated when it changes. */
export type UiLanguage = Locale | 'system'

export const DEFAULT_LOCALE: Locale = 'en'

/** localStorage key the config store persists under (pinia-plugin-persistedstate). */
const CONFIG_STORAGE_KEY = 'config'

export const isSupportedLocale = (locale: string): locale is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale)

/** `ru-RU` → `ru`. Null when the browser asks for something we do not speak. */
export const getBrowserLocale = (language?: string | null): Locale | null => {
  const tag = (language ?? navigator.language)?.split('-')[0]
  return tag && isSupportedLocale(tag) ? tag : null
}

/**
 * The locale the app should boot with: saved preference → browser → English.
 * Also stamps `<html lang>` so the UA hyphenates and spell-checks correctly.
 */
export const getInitialLocale = (): Locale => {
  let saved: Locale | null = null
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    const language: unknown = stored ? JSON.parse(stored)?.config?.uiLanguage : null
    if (typeof language === 'string' && language !== 'system' && isSupportedLocale(language)) {
      saved = language
    }
  } catch {
    // A corrupt or blocked storage is not a reason to fail the boot.
  }

  const locale = saved ?? getBrowserLocale() ?? DEFAULT_LOCALE
  document.documentElement.lang = locale
  return locale
}
