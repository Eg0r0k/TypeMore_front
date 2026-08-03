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
/**
 * Russian pluralisation.
 *
 * vue-i18n's built-in rule picks form 0 for zero, 1 for one and 2 for the rest
 * — which is not how Russian counts. Every three-form message in `ru.ts` is
 * written in the RUSSIAN order (`тест | теста | тестов`), so without this the
 * app renders "1 теста" and "0 тест" everywhere a count appears.
 *
 * The rule itself is the standard one: one for 1, 21, 31… (but not 11), few for
 * 2–4, 22–24… (but not 12–14), many for everything else, zero included.
 */
const russianPlural = (choice: number, choicesLength: number): number => {
  if (choicesLength < 3) return choice === 1 ? 0 : 1

  const count = Math.abs(choice)
  const lastDigit = count % 10
  const lastTwo = count % 100

  if (lastDigit === 1 && lastTwo !== 11) return 0
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 1
  return 2
}

export const i18n = createI18n<false>({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, ru },
  pluralRules: { ru: russianPlural }
})
