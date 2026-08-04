/**
 * The settings dialog's tab, as a thing OTHER screens can aim at.
 *
 * `openSettings('account')` is a deep link: the profile avatar means "let me
 * change what this page shows", and landing on the caret tab would make the
 * click a riddle. The request is one-shot on purpose — the interesting property
 * here is not that it arrives but that it stops applying once it has, because
 * the theme drill-down reopens this dialog and must return you to the tab you
 * left rather than to the one you originally arrived on.
 *
 * Every section is stubbed: this is a test about the shell, and the sections
 * drag in the whole API surface.
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/app/i18n/locales/en'
import { SettingsModal } from '@/features/modal/settings'
import { useDialogsStore } from '@/entities/dialogs'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/** What the tab strip reads for a category, in the test's locale. */
const label = (id: keyof typeof en.settings.category): string => en.settings.category[id]

/** App.vue's wiring, and nothing else: the store owns the flag. */
const Host = defineComponent({
  setup() {
    const dialogs = useDialogsStore()
    return () =>
      h(SettingsModal, {
        open: dialogs.settings,
        'onUpdate:open': (value: boolean) => (dialogs.settings = value)
      })
  }
})

const SECTIONS = [
  'InputSection',
  'SoundSection',
  'CaretSection',
  'AppearanceSection',
  'ThemeSection',
  'ProfileSection',
  'AccountSection',
  'DangerSection'
]

const mounted: { unmount: () => void }[] = []

const openDialog = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(Host, {
    global: {
      plugins: [i18n, pinia],
      stubs: Object.fromEntries(SECTIONS.map((name) => [name, true]))
    },
    attachTo: document.body
  })
  mounted.push(wrapper)
  return useDialogsStore()
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

/** The dialog is portalled into <body>, so the assertions read `document`. */
const activeTab = (): string =>
  document.querySelector('[aria-current="true"]')?.textContent?.trim() ?? ''

const clickTab = async (text: string): Promise<void> => {
  const tab = Array.from(document.querySelectorAll<HTMLElement>('button')).find(
    (button) => button.textContent?.trim() === text
  )
  if (!tab) throw new Error(`no tab "${text}"`)
  tab.click()
  await nextTick()
}

describe('settings dialog tabs', () => {
  it('opens on its usual tab when nobody asked for one', async () => {
    const dialogs = openDialog()
    dialogs.openSettings()
    await nextTick()
    expect(activeTab()).toBe(label('input'))
  })

  it('lands on the tab the opener asked for', async () => {
    const dialogs = openDialog()
    dialogs.openSettings('account')
    await nextTick()
    expect(activeTab()).toBe(label('account'))
    // And the request is spent, not remembered.
    expect(dialogs.settingsCategory).toBeNull()
  })

  it('leaves you where you were when the next open asks for nothing', async () => {
    const dialogs = openDialog()
    dialogs.openSettings('danger')
    await nextTick()
    expect(activeTab()).toBe(label('danger'))

    dialogs.settings = false
    await nextTick()
    dialogs.openSettings()
    await nextTick()
    // A plain open is "settings", not "settings, back to input": the dialog
    // keeps the tab, and only an explicit request moves it.
    expect(activeTab()).toBe(label('danger'))
  })

  it('comes back from the theme picker to the tab you left, not the one you arrived on', async () => {
    const dialogs = openDialog()
    dialogs.openSettings('account')
    await nextTick()

    await clickTab(label('appearance'))
    expect(activeTab()).toBe(label('appearance'))

    // The drill-down: settings steps aside while the theme dialog is up.
    dialogs.openThemes()
    await nextTick()
    dialogs.themes = false
    await nextTick()
    await nextTick()

    expect(activeTab()).toBe(label('appearance'))
  })
})
