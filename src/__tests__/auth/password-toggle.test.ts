/**
 * The eye toggle on the auth password fields.
 *
 * The icons used to sit in a `#left-icon` template on `Button` — a slot the
 * current Button does not have, so Vue discarded the content and the toggle
 * rendered as a tiny empty button. The icon must live in the default slot, and
 * `size-5` (not width/height attributes) is what keeps it out of Button's
 * `[&_svg:not([class*='size-'])]:size-4` clamp.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@app/i18n'
import en from '@app/i18n/locales/en'

vi.mock('@shared/api', async () => {
  const { ref } = await import('vue')
  return {
    useLoginMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
    oauthStartUrl: (provider: string) => `https://example.test/oauth/${provider}`
  }
})

import LoginPage from '@/pages/auth/login/ui.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'catch-all', component: { template: '<div />' } }]
})

const mountPage = () =>
  mount(LoginPage as never, {
    global: { plugins: [i18n, router], stubs: { RouterLink: true } }
  })

beforeEach(() => {
  i18n.global.locale.value = 'en'
})

describe('password visibility toggle', () => {
  it('renders the eye icon inside the toggle button', () => {
    const wrapper = mountPage()

    const toggle = wrapper.find(`button[aria-label="${en.auth.common.showPassword}"]`)
    expect(toggle.exists()).toBe(true)
    expect(toggle.find('svg').exists()).toBe(true)
  })

  it('click switches the input type and the accessible name', async () => {
    const wrapper = mountPage()

    await wrapper.find(`button[aria-label="${en.auth.common.showPassword}"]`).trigger('click')

    expect(wrapper.find('input[name="password"]').attributes('type')).toBe('text')
    const hide = wrapper.find(`button[aria-label="${en.auth.common.hidePassword}"]`)
    expect(hide.exists()).toBe(true)
    expect(hide.find('svg').exists()).toBe(true)
  })

  it('the OAuth buttons carry their brand icons', () => {
    const wrapper = mountPage()

    const oauth = wrapper
      .findAll('button')
      .filter((b) => b.text().includes('Continue with'))
    expect(oauth).toHaveLength(2)
    for (const button of oauth) {
      expect(button.find('svg').exists()).toBe(true)
    }
  })
})
