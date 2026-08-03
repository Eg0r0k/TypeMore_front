import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useDialogsStore } from '@/entities/dialogs'

/**
 * The app-level dialogs (settings, themes, cookies) are mounted once in App.vue
 * and opened from several places, so their open state — and the drill-down
 * between them — lives here rather than in whichever component happened to
 * mount them.
 */
describe('dialogs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens settings without touching anything else', () => {
    const dialogs = useDialogsStore()
    dialogs.openSettings()
    expect(dialogs.settings).toBe(true)
    expect(dialogs.themes).toBe(false)
    expect(dialogs.cookies).toBe(false)
  })

  it('drills from settings into themes and comes back when they close', async () => {
    const dialogs = useDialogsStore()
    dialogs.openSettings()
    dialogs.openThemes()
    // Not stacked: two reka dialogs share one dismiss chain, so settings steps
    // aside while the child is up.
    expect(dialogs.settings).toBe(false)
    expect(dialogs.themes).toBe(true)

    // Let the open settle first: a flag that goes up and down inside one tick
    // has not changed as far as a watcher is concerned.
    await nextTick()
    dialogs.themes = false
    await nextTick()
    expect(dialogs.settings).toBe(true)
  })

  it('does NOT come back when the child was opened on its own', async () => {
    const dialogs = useDialogsStore()
    dialogs.openThemes()
    expect(dialogs.settings).toBe(false)

    await nextTick()
    dialogs.themes = false
    await nextTick()
    expect(dialogs.settings).toBe(false)
  })

  it('tells the two cookie callers apart', async () => {
    const dialogs = useDialogsStore()

    // The first-visit gate: no way out but a choice.
    dialogs.requireCookieConsent()
    expect(dialogs.cookies).toBe(true)
    expect(dialogs.cookiesDismissible).toBe(false)
    await nextTick()
    dialogs.cookies = false
    await nextTick()
    // It was not opened from settings, so nothing reopens.
    expect(dialogs.settings).toBe(false)

    // The settings row: an ordinary dialog you can walk out of.
    dialogs.openSettings()
    dialogs.openCookies()
    expect(dialogs.cookiesDismissible).toBe(true)
    expect(dialogs.settings).toBe(false)
    await nextTick()
    dialogs.cookies = false
    await nextTick()
    expect(dialogs.settings).toBe(true)
  })
})
