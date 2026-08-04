import type { Component, InjectionKey } from 'vue'

import IconKeyboard from '~icons/tabler/keyboard'
import IconVolume from '~icons/tabler/volume'
import IconCursorText from '~icons/tabler/cursor-text'
import IconPalette from '~icons/tabler/palette'
import IconShieldLock from '~icons/tabler/shield-lock'
import IconAlertTriangle from '~icons/tabler/alert-triangle'

import type { SettingsCategory } from '@/entities/dialogs'

/**
 * The settings dialog is data-driven in ONE respect only: search. Every row
 * declares itself here so the search box can match a query against its
 * translated label + description without the shell knowing how the row renders
 * (a switch, a slider, a colour grid...). The controls themselves stay inline
 * in their section — a generic control renderer would buy nothing and cost
 * every future setting a detour through an abstraction.
 */
/**
 * The category vocabulary itself lives in `entities/dialogs`, because openers
 * ask for a tab by name (`openSettings('account')`) and they cannot see this
 * file — features are not importable from below. Aliased here so everything in
 * this slice keeps calling it what it has always been called.
 */
export type CategoryId = SettingsCategory

export type SettingId =
  | 'freedomMode'
  | 'stopOnError'
  | 'quickEnd'
  | 'soundVolume'
  | 'soundOnClick'
  | 'soundOnError'
  | 'smoothCaret'
  | 'caretStyle'
  | 'uiLanguage'
  | 'fontFamily'
  | 'fontSize'
  | 'showFps'
  | 'background'
  | 'theme'
  | 'colors'
  | 'profilePublic'
  | 'keyboardPublic'
  | 'data'
  | 'reset'
  | 'cookies'

export interface CategoryMeta {
  id: CategoryId
  icon: Component
}

export interface SettingMeta {
  id: SettingId
  category: CategoryId
  /** Terms a user may search for that appear in neither label nor description. */
  keywords?: readonly string[]
}

// Appearance carries the palette icon: the theme rows live in it now — one
// "how it looks" tab instead of two.
export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'input', icon: IconKeyboard },
  { id: 'sound', icon: IconVolume },
  { id: 'caret', icon: IconCursorText },
  { id: 'appearance', icon: IconPalette },
  // Account: the SERVER-persisted switches (profile privacy). Everything else
  // in this dialog is a local preference; these two travel with the account.
  { id: 'account', icon: IconShieldLock },
  { id: 'danger', icon: IconAlertTriangle }
]

export const SETTINGS: readonly SettingMeta[] = [
  { id: 'freedomMode', category: 'input', keywords: ['backspace', 'delete'] },
  { id: 'stopOnError', category: 'input', keywords: ['mistake', 'strict'] },
  { id: 'quickEnd', category: 'input', keywords: ['finish', 'last word'] },
  { id: 'soundVolume', category: 'sound', keywords: ['loud', 'mute'] },
  { id: 'soundOnClick', category: 'sound', keywords: ['click', 'pack', 'typing', 'keyboard'] },
  { id: 'soundOnError', category: 'sound', keywords: ['mistake', 'wrong', 'typo'] },
  { id: 'smoothCaret', category: 'caret', keywords: ['cursor', 'animation'] },
  { id: 'caretStyle', category: 'caret', keywords: ['cursor', 'block', 'underline'] },
  { id: 'uiLanguage', category: 'appearance', keywords: ['locale', 'russian', 'english', 'язык'] },
  { id: 'fontFamily', category: 'appearance', keywords: ['typeface', 'font'] },
  { id: 'fontSize', category: 'appearance', keywords: ['font', 'bigger', 'smaller'] },
  { id: 'showFps', category: 'appearance', keywords: ['frame rate', 'performance'] },
  { id: 'background', category: 'appearance', keywords: ['image', 'wallpaper', 'picture'] },
  { id: 'theme', category: 'appearance', keywords: ['colors', 'preset', 'dark', 'light'] },
  { id: 'colors', category: 'appearance', keywords: ['palette', 'custom', 'hex'] },
  {
    id: 'profilePublic',
    category: 'account',
    keywords: ['privacy', 'private', 'public', 'profile', 'закрыт', 'приватность']
  },
  {
    id: 'keyboardPublic',
    category: 'account',
    keywords: ['privacy', 'heatmap', 'portrait', 'keyboard', 'biometric', 'клавиатура']
  },
  { id: 'data', category: 'danger', keywords: ['json', 'backup', 'import', 'export'] },
  { id: 'reset', category: 'danger', keywords: ['default', 'defaults', 'wipe', 'restore'] },
  { id: 'cookies', category: 'danger', keywords: ['consent', 'privacy', 'gdpr'] }
]

/**
 * Provided by the dialog shell, consumed by every `SettingRow`: whether a row
 * survives the current search query. Absent (no provider) means "show it" so a
 * section can be rendered standalone in a test.
 */
export interface SettingsFilter {
  isVisible: (id: SettingId) => boolean
}

export const SETTINGS_FILTER: InjectionKey<SettingsFilter> = Symbol('settings-filter')

/**
 * Drill-down navigation handed to the sections. The theme and cookie dialogs are
 * NOT nested inside the settings dialog: the shell hides itself, shows the other
 * dialog, and comes back when it closes. Stacked reka dialogs share one dismiss
 * chain, so closing the inner one tore down the outer one with it.
 */
export interface SettingsNav {
  openThemes: () => void
  openCookies: () => void
}

export const SETTINGS_NAV: InjectionKey<SettingsNav> = Symbol('settings-nav')
