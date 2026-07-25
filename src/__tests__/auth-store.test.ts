import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { QueryClient, VueQueryPlugin, type UseQueryReturnType } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the S1 API barrel: no network. `meFn` is the controllable `/me` queryFn.
const { meFn } = vi.hoisted(() => ({ meFn: vi.fn() }))
vi.mock('@shared/api', () => ({
  meQueryOptions: () => ({ queryKey: ['me'], queryFn: meFn })
}))

import { useAuthBootstrap, useAuthStore } from '@entities/auth'
import type { User } from '@shared/api'

const USER: User = { id: 'u1', displayName: 'Egor', createdAt: '2026-01-01T00:00:00Z' }

let pinia: Pinia
let capturedQuery: UseQueryReturnType<User, Error>

const mountBootstrap = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  const Comp = defineComponent({
    setup() {
      capturedQuery = useAuthBootstrap() as UseQueryReturnType<User, Error>
      return () => h('div')
    }
  })
  return mount(Comp, { global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] } })
}

describe('auth store bootstrap', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    meFn.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to unknown before /me resolves', () => {
    meFn.mockReturnValue(Promise.withResolvers<User>().promise) // never settles
    mountBootstrap()
    expect(useAuthStore().status).toBe('unknown')
  })

  it('unknown -> authed when /me resolves a user', async () => {
    meFn.mockResolvedValue(USER)
    mountBootstrap()
    expect(useAuthStore().status).toBe('unknown')

    await flushPromises()

    expect(useAuthStore().status).toBe('authed')
    expect(useAuthStore().isAuth).toBe(true)
  })

  it('unknown -> guest silently on a 401 (no throw)', async () => {
    meFn.mockRejectedValue({ status: 401, code: 'unauthorized' })
    mountBootstrap()

    await flushPromises()

    const store = useAuthStore()
    expect(store.status).toBe('guest')
    expect(store.isGuest).toBe(true)
    expect(store.isAuth).toBe(false)
  })

  it('flips authed -> guest on a LATER 401 (refetch)', async () => {
    meFn.mockResolvedValueOnce(USER).mockRejectedValue({ status: 401, code: 'unauthorized' })
    mountBootstrap()

    await flushPromises()
    expect(useAuthStore().status).toBe('authed')

    await capturedQuery.refetch()
    await flushPromises()

    expect(useAuthStore().status).toBe('guest')
  })
})
