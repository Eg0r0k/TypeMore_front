/**
 * The modals are self-contained `v-model:open` dialogs (no global modal store):
 * each one owns its open state through `defineModel`, and the first-run cookie
 * consent is the only non-dismissable one (`:dismissible="false"`).
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { i18n } from '@app/i18n'
import { THEMES_KEY } from '@/shared/constants/inject-keys'
import { stubElementSize } from './helpers/element-size'

// The themes dialog is a console list, and that list is virtualized: with no
// viewport height happy-dom renders zero rows.
let restoreSizes: () => void
beforeAll(() => (restoreSizes = stubElementSize()))
afterAll(() => restoreSizes())

vi.mock('~icons/tabler/cookie', () => ({
  default: { name: 'IconCookie', template: '<svg data-icon="cookie" />' }
}))
vi.mock('~icons/tabler/clipboard', () => ({
  default: { name: 'IconClipboard', template: '<svg data-icon="clipboard" />' }
}))

const session = reactive({ room: null as unknown, lastError: null as unknown, joinRoom: vi.fn() })
vi.mock('@/entities/match', () => ({ useMatchSessionStore: () => session }))

import { CookieModal } from '@/features/modal/cookie'
import { ThemesModal } from '@/features/modal/themes'
import { JoinCodeModal } from '@/features/modal/joinCode'
import { TooltipProvider } from '@/shared/ui/tooltip'

const noopDirective = {}
const global = {
  plugins: [i18n],
  directives: { focus: noopDirective, 'max-chars': noopDirective, select: noopDirective }
}

describe('modal dialogs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('cookie dialog is non-dismissable and closes after a choice', async () => {
    const wrapper = mount(CookieModal, {
      props: { open: true, dismissible: false },
      global,
      attachTo: document.body
    })
    await nextTick()
    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content).toBeTruthy()
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull()
    expect(document.body.textContent).toContain('We use Cookies')

    content!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(content!.getAttribute('data-state')).toBe('open')

    const accept = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Accept all')
    )!
    accept.click()
    await nextTick()
    expect(localStorage.getItem('cookieConsentGiven')).toBe('true')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('cookie dialog is dismissible by default', async () => {
    const wrapper = mount(CookieModal, { props: { open: true }, global, attachTo: document.body })
    await nextTick()
    const content = document.querySelector('[data-slot="dialog-content"]')!
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeTruthy()

    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('themes dialog renders the console list only while open', async () => {
    const themeList = ref([
      {
        name: 'dark',
        '--bg-color': '#000',
        '--main-color': '#f00',
        '--sub-color': '#0f0',
        '--text-color': '#fff'
      }
    ])
    const wrapper = mount(ThemesModal, {
      props: { open: false },
      global: { ...global, provide: { [THEMES_KEY as unknown as symbol]: themeList } },
      attachTo: document.body
    })
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).toBeNull()

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.querySelector('[role="listbox"]')).toBeTruthy()
    expect(document.body.textContent).toContain('dark')
  })

  it('join-code dialog closes itself once seated', async () => {
    const open = ref(true)
    const host = {
      components: { TooltipProvider, JoinCodeModal },
      setup: () => ({ open }),
      template: '<TooltipProvider><JoinCodeModal v-model:open="open" /></TooltipProvider>'
    }
    mount(host, { global, attachTo: document.body })
    await nextTick()
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy()

    session.room = { id: 'r1' }
    await nextTick()
    await nextTick()
    expect(open.value).toBe(false)
    expect(document.querySelector('[data-slot="dialog-content"]')?.getAttribute('data-state')).toBe(
      'closed'
    )
    session.room = null
  })
})
