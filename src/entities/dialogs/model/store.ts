import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * The APP-LEVEL dialogs: settings, the theme picker, the cookie notice.
 *
 * Every other modal in this app is self-contained and owned by whoever opens it
 * (see AGENTS.md) — and that is still the rule. These three are the exception
 * because they are opened from several unrelated places (the header, the
 * profile, the settings dialog itself, and the first-visit boot check), and a
 * per-opener instance meant the same heavy dialog tree was mounted more than
 * once, with its own copy of the open state. They are mounted ONCE in App.vue
 * and every opener flips a flag here instead.
 *
 * The drill-down is here too, because it is a relationship BETWEEN dialogs and
 * belonged to no single one of them: opening the theme (or cookie) dialog from
 * inside settings closes settings and reopens it when the child closes. Two
 * stacked reka dialogs share one dismiss chain, so closing the inner one used
 * to drag the outer down with it.
 */
export const useDialogsStore = defineStore('dialogs', () => {
  const settings = ref(false)
  const themes = ref(false)
  const cookies = ref(false)

  /**
   * The cookie notice has two callers with opposite rules: the first-visit gate
   * (no way out but a choice) and the settings row (an ordinary dialog).
   */
  const cookiesDismissible = ref(true)

  /** Set when a child was opened FROM settings, so settings can come back. */
  const returnToSettings = ref(false)

  const openSettings = (): void => {
    settings.value = true
  }

  /** Step out of settings, remembering to step back in. */
  const leaveSettings = (): void => {
    if (!settings.value) return
    settings.value = false
    returnToSettings.value = true
  }

  const openThemes = (): void => {
    leaveSettings()
    themes.value = true
  }

  const openCookies = (): void => {
    leaveSettings()
    cookiesDismissible.value = true
    cookies.value = true
  }

  /** The first-visit gate: the same dialog, with no way out but a choice. */
  const requireCookieConsent = (): void => {
    cookiesDismissible.value = false
    cookies.value = true
  }

  watch([themes, cookies], ([themesOpen, cookiesOpen]) => {
    if (themesOpen || cookiesOpen) return
    if (!returnToSettings.value) return
    returnToSettings.value = false
    settings.value = true
  })

  return {
    settings,
    themes,
    cookies,
    cookiesDismissible,
    openSettings,
    openThemes,
    openCookies,
    requireCookieConsent
  }
})
