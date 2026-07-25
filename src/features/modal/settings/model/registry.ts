import type { Component, InjectionKey } from 'vue'

import IconKeyboard from '~icons/tabler/keyboard'
import IconVolume from '~icons/tabler/volume'
import IconCursorText from '~icons/tabler/cursor-text'
import IconTypography from '~icons/tabler/typography'
import IconPalette from '~icons/tabler/palette'
import IconAlertTriangle from '~icons/tabler/alert-triangle'

/**
 * The settings dialog is data-driven in ONE respect only: search. Every row
 * declares itself here so the search box can match a query against its
 * translated label + description without the shell knowing how the row renders
 * (a switch, a slider, a colour grid...). The controls themselves stay inline
 * in their section — a generic control renderer would buy nothing and cost
 * every future setting a detour through an abstraction.
 */
export type CategoryId = 'input' | 'sound' | 'caret' | 'appearance' | 'theme' | 'danger'

export type SettingId =
  | 'freedomMode'
  | 'stopOnError'
  | 'quickEnd'
  | 'soundVolume'
  | 'soundOnClick'
  | 'smoothCaret'
  | 'caretStyle'
  | 'uiLanguage'
  | 'fontFamily'
  | 'fontSize'
  | 'showFps'
  | 'background'
  | 'theme'
  | 'colors'
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

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'input', icon: IconKeyboard },
  { id: 'sound', icon: IconVolume },
  { id: 'caret', icon: IconCursorText },
  { id: 'appearance', icon: IconTypography },
  { id: 'theme', icon: IconPalette },
  { id: 'danger', icon: IconAlertTriangle }
]

export const SETTINGS: readonly SettingMeta[] = [
  { id: 'freedomMode', category: 'input', keywords: ['backspace', 'delete'] },
  { id: 'stopOnError', category: 'input', keywords: ['mistake', 'strict'] },
  { id: 'quickEnd', category: 'input', keywords: ['finish', 'last word'] },
  { id: 'soundVolume', category: 'sound', keywords: ['loud', 'mute'] },
  { id: 'soundOnClick', category: 'sound', keywords: ['click', 'pack', 'typing'] },
  { id: 'smoothCaret', category: 'caret', keywords: ['cursor', 'animation'] },
  { id: 'caretStyle', category: 'caret', keywords: ['cursor', 'block', 'underline'] },
  { id: 'uiLanguage', category: 'appearance', keywords: ['locale', 'russian', 'english', 'язык'] },
  { id: 'fontFamily', category: 'appearance', keywords: ['typeface', 'font'] },
  { id: 'fontSize', category: 'appearance', keywords: ['font', 'bigger', 'smaller'] },
  { id: 'showFps', category: 'appearance', keywords: ['frame rate', 'performance'] },
  { id: 'background', category: 'theme', keywords: ['image', 'wallpaper', 'picture'] },
  { id: 'theme', category: 'theme', keywords: ['colors', 'preset', 'dark', 'light'] },
  { id: 'colors', category: 'theme', keywords: ['palette', 'custom', 'hex'] },
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
