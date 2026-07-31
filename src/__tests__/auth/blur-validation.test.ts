/**
 * Blurring an untouched auth field must show the localized "required" message.
 *
 * Until a field receives input, vee-validate's values object has NO key for it.
 * valibot v1's `v.object` reports a missing key itself — `Invalid key: Expected
 * "email" but received undefined` — before the entry schema (which carries the
 * localized message) ever runs. Seeding `initialValues` keeps every key present
 * from the start, so `nonEmpty` fires with the intended copy instead.
 *
 * Fake timers for the same reason as turnstile-captcha.test.ts: vee-validate
 * debounces schema validation by 5 ms.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@app/i18n'
import en from '@app/i18n/locales/en'

vi.mock('@shared/api', async () => {
  const { ref } = await import('vue')
  return {
    useLoginMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
    usePasswordResetConfirmMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
    oauthStartUrl: (provider: string) => `https://example.test/oauth/${provider}`
  }
})

import LoginPage from '@/pages/auth/login/ui.vue'
import ResetConfirmPage from '@/pages/auth/reset-confirm/ui.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'catch-all', component: { template: '<div />' } }]
})

const mountPage = (component: unknown) =>
  mount(component as never, {
    global: { plugins: [i18n, router], stubs: { RouterLink: true } }
  })

/** Drains microtasks AND vee-validate's 5 ms validation debounce. */
const settle = () => vi.advanceTimersByTimeAsync(20)

beforeEach(() => {
  vi.useFakeTimers()
  i18n.global.locale.value = 'en'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('blurring an untouched field', () => {
  it('login email shows the localized required message, not a raw schema error', async () => {
    const wrapper = mountPage(LoginPage)
    await settle()

    await wrapper.find('input[name="email"]').trigger('blur')
    await settle()

    expect(wrapper.text()).not.toContain('Invalid key')
    expect(wrapper.text()).toContain(en.auth.validation.emailRequired)
  })

  it('login password behaves the same', async () => {
    const wrapper = mountPage(LoginPage)
    await settle()

    await wrapper.find('input[name="password"]').trigger('blur')
    await settle()

    expect(wrapper.text()).not.toContain('Invalid key')
    expect(wrapper.text()).toContain(en.auth.validation.passwordRequired)
  })

  it('reset-confirm password behaves the same', async () => {
    // The form only renders with a token in the query.
    await router.push('/reset-confirm?token=tok-1')
    const wrapper = mountPage(ResetConfirmPage)
    await settle()

    await wrapper.find('input[name="password"]').trigger('blur')
    await settle()

    expect(wrapper.text()).not.toContain('Invalid key')
    expect(wrapper.text()).toContain(en.auth.validation.passwordRequired)
  })
})
