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

/**
 * Which tab the settings dialog should land on.
 *
 * The union lives HERE, not in the settings dialog's own registry, for one
 * reason: openers sit above this layer and the dialog sits above it too, so
 * this is the only place both can see. It is the vocabulary of the request —
 * everything else about a category (its icon, its order, which rows belong to
 * it) stays in `features/modal/settings/model/registry.ts`, which types its
 * `CATEGORIES` against this union and therefore cannot drift from it.
 */
export type SettingsCategory = 'input' | 'sound' | 'caret' | 'appearance' | 'account' | 'danger'

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

  /**
   * A ONE-SHOT request for a tab, not "the tab settings is on". The dialog
   * consumes it (clears it) the moment it lands, which is what keeps the
   * drill-down honest: coming back from the theme picker must return you to the
   * tab you left, not to the tab whoever opened the dialog originally asked for.
   */
  const settingsCategory = ref<SettingsCategory | null>(null)

  /** Open settings, optionally on a named tab (`openSettings('account')`). */
  const openSettings = (category?: SettingsCategory): void => {
    settingsCategory.value = category ?? null
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
    settingsCategory,
    themes,
    cookies,
    cookiesDismissible,
    openSettings,
    openThemes,
    openCookies,
    requireCookieConsent
  }
})
