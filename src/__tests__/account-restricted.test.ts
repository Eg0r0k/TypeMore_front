import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

import { AccountRestricted } from '@/features/account-restricted'
import { meQueryOptions } from '@shared/api'
import en from '@/app/i18n/locales/en'

/**
 * The restricted banner renders from `/me` and from nothing else.
 *
 * Two things are asserted and the second matters as much as the first: that the
 * line appears when the account is restricted, and that it says ONLY that. The
 * server keeps the moderation note internal and hands the client a bare
 * boolean, so a banner that grew a reason or an expiry would mean somebody
 * widened the API (backend docs/MODERATION.md).
 */
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

let queryClient: QueryClient
const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } }
  })
})

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  queryClient.clear()
})

function mountWith(user: Record<string, unknown> | null) {
  if (user !== null) queryClient.setQueryData(meQueryOptions().queryKey, user)
  const wrapper = mount(AccountRestricted, {
    global: { plugins: [i18n, createPinia(), [VueQueryPlugin, { queryClient }]] }
  })
  mounted.push(wrapper)
  return wrapper
}

const baseUser = { id: 'u1', displayName: 'ada', createdAt: '2026-01-01T00:00:00Z' }

describe('the account-restricted banner', () => {
  it('renders nothing for an unrestricted account', () => {
    const wrapper = mountWith({ ...baseUser, restricted: false })
    expect(wrapper.find('[data-testid="account-restricted"]').exists()).toBe(false)
  })

  it('renders nothing for a guest, where /me resolved no user', () => {
    const wrapper = mountWith(null)
    expect(wrapper.find('[data-testid="account-restricted"]').exists()).toBe(false)
  })

  it('renders a single quiet line when the account is restricted', () => {
    const wrapper = mountWith({ ...baseUser, restricted: true })
    const banner = wrapper.find('[data-testid="account-restricted"]')

    expect(banner.exists()).toBe(true)
    expect(banner.text()).toBe(en.auth.header.restricted)
  })

  it('offers no reason, no expiry and no appeal', () => {
    const wrapper = mountWith({ ...baseUser, restricted: true })

    // Nothing actionable: the banner is a statement, not a form.
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.findAll('a')).toHaveLength(0)
    // And nothing the server never sent.
    const text = wrapper.text().toLowerCase()
    for (const leak of ['reason', 'expires', 'until', 'appeal', 'issued']) {
      expect(text).not.toContain(leak)
    }
  })
})
