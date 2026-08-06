/**
 * The restriction indicator lives IN the account menu now: the warning mark
 * replaces the avatar and the name turns error-coloured. Two things are
 * asserted and the second matters as much as the first: that the mark appears
 * when the account is restricted, and that nothing beyond the bare fact is
 * disclosed — the server hands the client one boolean
 * (backend docs/MODERATION.md), so a reason or an expiry appearing here would
 * mean somebody widened the API.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

import en from '@/app/i18n/locales/en'

const h = vi.hoisted(() => ({
  me: vi.fn(),
  permissions: [] as string[]
}))

vi.mock('@shared/api', () => ({
  meQueryOptions: () => ({ queryKey: ['auth', 'me'], queryFn: h.me, retry: false }),
  useLogoutMutation: () => ({ mutate: vi.fn() })
}))

const { Navigation } = await import('@/features/header/navigation')
const { useAuthStore } = await import('@/entities/auth')

const baseUser = {
  id: 'u1',
  displayName: 'ada',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: [] as string[]
}

async function mountNav(user: Record<string, unknown>) {
  h.me.mockResolvedValue(user)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().setAuthed()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div />' } }]
  })
  const wrapper = mount(Navigation, {
    props: { links: [] },
    global: {
      plugins: [
        router,
        pinia,
        createI18n({ legacy: false, locale: 'en', messages: { en } }),
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
        ]
      ]
    }
  })
  await flushPromises()
  return wrapper
}

describe('the account menu under a restriction', () => {
  beforeEach(() => h.me.mockReset())

  it('shows the avatar and no mark for an account in good standing', async () => {
    const wrapper = await mountNav({ ...baseUser, restricted: false })
    expect(wrapper.find('[data-testid="account-restricted"]').exists()).toBe(false)
  })

  it('trades the avatar for the warning mark and turns the name red', async () => {
    const wrapper = await mountNav({ ...baseUser, restricted: true })

    expect(wrapper.find('[data-testid="account-restricted"]').exists()).toBe(true)
    const name = wrapper.findAll('span').find((el) => el.text() === 'ada')
    expect(name?.classes()).toContain('text-error')
    // The words stay one hover away — and they are the ONLY words.
    expect(wrapper.get('.controls__user').attributes('title')).toBe(en.auth.header.restricted)
  })

  it('discloses nothing the server never sent', async () => {
    const wrapper = await mountNav({ ...baseUser, restricted: true })
    const text = wrapper.text().toLowerCase()
    for (const leak of ['reason', 'expires', 'until', 'appeal', 'issued']) {
      expect(text).not.toContain(leak)
    }
  })
})
