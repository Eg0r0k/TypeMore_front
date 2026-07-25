import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getBrowserLocale, getInitialLocale, isSupportedLocale } from '@/shared/lib/i18n/locale'

/**
 * Locale resolution runs before the app exists: it reads `navigator.language`
 * and the persisted config straight out of localStorage. The order (saved →
 * browser → English) is the contract every screen inherits.
 */
const setBrowserLanguage = (value: string): void => {
  Object.defineProperty(window.navigator, 'language', { value, configurable: true })
}

const saveConfig = (config: Record<string, unknown>): void => {
  localStorage.setItem('config', JSON.stringify({ config }))
}

describe('locale detection', () => {
  beforeEach(() => {
    localStorage.clear()
    setBrowserLanguage('en-US')
    document.documentElement.lang = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('narrows a region tag to a supported locale', () => {
    expect(getBrowserLocale('ru-RU')).toBe('ru')
    expect(getBrowserLocale('en')).toBe('en')
  })

  it('reports null for a language the app does not speak', () => {
    expect(getBrowserLocale('de-DE')).toBeNull()
    expect(getBrowserLocale('')).toBeNull()
  })

  it('falls back to the browser when nothing is saved', () => {
    setBrowserLanguage('ru-RU')
    expect(getInitialLocale()).toBe('ru')
  })

  it('falls back to English when the browser speaks something else', () => {
    setBrowserLanguage('ja-JP')
    expect(getInitialLocale()).toBe('en')
  })

  it('prefers an explicitly saved language over the browser', () => {
    setBrowserLanguage('ru-RU')
    saveConfig({ uiLanguage: 'en' })
    expect(getInitialLocale()).toBe('en')
  })

  it('follows the browser when the saved language is `system`', () => {
    setBrowserLanguage('ru-RU')
    saveConfig({ uiLanguage: 'system' })
    expect(getInitialLocale()).toBe('ru')
  })

  it('ignores a saved language that is no longer supported', () => {
    setBrowserLanguage('ru-RU')
    saveConfig({ uiLanguage: 'de' })
    expect(getInitialLocale()).toBe('ru')
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('config', '{not json')
    setBrowserLanguage('ru-RU')
    expect(getInitialLocale()).toBe('ru')
  })

  it('stamps the resolved locale on <html lang>', () => {
    setBrowserLanguage('ru-RU')
    getInitialLocale()
    expect(document.documentElement.lang).toBe('ru')
  })

  it('guards the supported set', () => {
    expect(isSupportedLocale('ru')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(false)
  })
})
