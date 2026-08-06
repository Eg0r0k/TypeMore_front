/**
 * The player card. The server owns identifier resolution (uuid → email →
 * nick, refusing ambiguity), so the card renders its answers as states: a 404
 * is "nobody", a 409 is a choice whose pick re-asks BY UUID, and every
 * mutation goes out with the uuid — never with what was typed.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import en from '@/app/i18n/locales/en'

const h = vi.hoisted(() => {
  class MockApiError extends Error {
    readonly status: number
    readonly code: string
    readonly details?: unknown
    constructor(status: number, code: string, details?: unknown) {
      super(code)
      this.status = status
      this.code = code
      this.details = details
    }
  }
  return {
    MockApiError,
    bans: vi.fn(),
    badges: vi.fn(),
    issueBan: vi.fn(),
    revokeBan: vi.fn(),
    suggest: vi.fn(),
    permissions: ['bans:read', 'bans:write'] as string[]
  }
})

vi.mock('@shared/api', async () => {
  const v = await import('valibot')
  const mutation = (fn: (input: never) => Promise<unknown>) => () => ({
    isPending: ref(false),
    mutate: (input: never, opts?: { onSuccess?: (r: unknown) => void; onError?: () => void }) => {
      fn(input).then(
        (r) => opts?.onSuccess?.(r),
        () => opts?.onError?.()
      )
    }
  })
  return {
    isApiError: (value: unknown): boolean => value instanceof h.MockApiError,
    // The live-search trio usePlayerSearch reads; the real bounds, so the
    // "does not ask below three characters" behaviour stays real.
    SEARCH_MIN_QUERY_LEN: 3,
    isSearchable: (query: string): boolean => {
      const length = [...query.trim()].length
      return length >= 3 && length <= 20
    },
    userSearchQueryOptions: (query: string) => ({
      queryKey: ['users', 'search', query.trim()],
      queryFn: () => h.suggest(query),
      retry: false
    }),
    ResolutionCandidatesSchema: v.object({
      candidates: v.array(v.object({ id: v.string(), displayName: v.string() }))
    }),
    playerBansQueryOptions: (identifier: string) => ({
      queryKey: ['admin', 'player', identifier, 'bans'],
      queryFn: () => h.bans(identifier),
      retry: false
    }),
    playerBadgesQueryOptions: (identifier: string) => ({
      queryKey: ['admin', 'player', identifier, 'badges'],
      queryFn: () => h.badges(identifier),
      retry: false
    }),
    useIssueBanMutation: mutation(h.issueBan),
    useRevokeBanMutation: mutation(h.revokeBan),
    useGrantBadgeMutation: mutation(() => Promise.resolve({})),
    useRevokeBadgeMutation: mutation(() => Promise.resolve({}))
  }
})

vi.mock('@/entities/auth', () => ({
  usePermissions: () => ({
    permissions: ref(h.permissions),
    isModerator: ref(true),
    can: (permission: string) => h.permissions.includes(permission)
  })
}))

const { PlayerCard } = await import('@/features/admin')

const UUID = '22222222-0000-4000-8000-000000000002'

const bansAnswer = (overrides: Record<string, unknown> = {}) => ({
  user: { id: UUID, displayName: 'grief3r' },
  restricted: true,
  bans: [
    {
      id: 'b1',
      userId: UUID,
      reason: 'wpm 400 run',
      issuedBy: 'egor',
      issuedAt: '2026-08-01T10:00:00Z',
      active: true
    }
  ],
  ...overrides
})

const badgesAnswer = () => ({
  user: { id: UUID, displayName: 'grief3r' },
  badges: [
    {
      code: 'translator',
      grantedAt: '2026-07-01T10:00:00Z',
      grantedBy: 'egor',
      granted: true,
      shown: false
    }
  ],
  knownBadges: ['staff', 'translator']
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/u/:name', name: 'user', component: { template: '<div />' } }
    ]
  })
}

function mountWith(router: ReturnType<typeof makeRouter>) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  return mount(PlayerCard, {
    global: {
      plugins: [
        router,
        i18n,
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
        ]
      ]
    }
  })
}

const mountCard = () => mountWith(makeRouter())

async function search(wrapper: ReturnType<typeof mountCard>, query: string): Promise<void> {
  await wrapper.get('[data-testid="admin-player-search"] input').setValue(query)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('the player card', () => {
  beforeEach(() => {
    h.bans.mockReset()
    h.badges.mockReset()
    h.issueBan.mockReset()
    h.revokeBan.mockReset()
    h.suggest.mockReset()
    h.permissions = ['bans:read', 'bans:write']
    h.badges.mockResolvedValue(badgesAnswer())
    h.suggest.mockResolvedValue({ users: [] })
  })

  it('suggests names as you type, and a click opens the card', async () => {
    vi.useFakeTimers()
    try {
      h.suggest.mockResolvedValue({
        users: [{ name: 'grief3r', joined: '2026-07-01T10:00:00Z', public: true }]
      })
      h.bans.mockResolvedValue(bansAnswer())
      const wrapper = mountCard()

      await wrapper.get('[data-testid="admin-player-search"] input').setValue('grie')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect(h.suggest).toHaveBeenCalledWith('grie')
      await wrapper.get('[data-testid="admin-player-suggestion-grief3r"]').trigger('click')
      await flushPromises()

      expect(h.bans).toHaveBeenCalledWith('grief3r')
      expect(wrapper.get('[data-testid="admin-player-header"]').text()).toContain('grief3r')
      expect(wrapper.find('[data-testid="admin-player-suggestions"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders the resolved player: restriction, ban history, badges', async () => {
    h.bans.mockResolvedValue(bansAnswer())
    const wrapper = mountCard()
    await search(wrapper, 'grief3r')

    expect(h.bans).toHaveBeenCalledWith('grief3r')
    const header = wrapper.get('[data-testid="admin-player-header"]')
    expect(header.text()).toContain('grief3r')
    expect(wrapper.find('[data-testid="admin-player-restricted"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="admin-bans-list"]').text()).toContain('wpm 400 run')
    expect(wrapper.get('[data-testid="admin-badges-list"]').text()).toContain('translator')
    expect(wrapper.get('[data-testid="admin-player-profile-link"]').attributes('href')).toBe(
      '/u/grief3r'
    )
  })

  it('opens straight from ?u= — the hop another admin screen makes', async () => {
    h.bans.mockResolvedValue(bansAnswer())
    const router = makeRouter()
    // The navigation settles BEFORE mount, the way a real hop arrives.
    await router.push(`/?u=${UUID}`)
    const wrapper = mountWith(router)
    await flushPromises()

    expect(h.bans).toHaveBeenCalledWith(UUID)
    expect(wrapper.get('[data-testid="admin-player-header"]').text()).toContain('grief3r')
  })

  it('answers an unknown identifier with "nobody", not an error card', async () => {
    h.bans.mockImplementation(() => Promise.reject(new h.MockApiError(404, 'not_found')))
    const wrapper = mountCard()
    await search(wrapper, 'ghost')

    expect(wrapper.find('[data-testid="admin-player-not-found"]').exists()).toBe(true)
  })

  it('renders an ambiguous identifier as a choice, and picks by uuid', async () => {
    h.bans.mockImplementationOnce(() =>
      Promise.reject(
        new h.MockApiError(409, 'ambiguous_identifier', {
          candidates: [
            { id: UUID, displayName: 'grief3r' },
            { id: '33333333-0000-4000-8000-000000000003', displayName: 'grief3r2' }
          ]
        })
      )
    )
    h.bans.mockResolvedValue(bansAnswer())
    const wrapper = mountCard()
    await search(wrapper, 'grief')

    await wrapper.get('[data-testid="admin-player-candidate-grief3r"]').trigger('click')
    await flushPromises()

    expect(h.bans).toHaveBeenLastCalledWith(UUID)
    expect(wrapper.get('[data-testid="admin-player-header"]').text()).toContain('grief3r')
  })

  it('issues a ban by uuid with the trimmed note and term', async () => {
    h.bans.mockResolvedValue(bansAnswer({ bans: [] }))
    h.issueBan.mockResolvedValue({
      user: { id: UUID, displayName: 'grief3r' },
      ban: {},
      amended: false
    })
    const wrapper = mountCard()
    await search(wrapper, 'grief3r')

    await wrapper.get('[data-testid="admin-ban-reason"]').setValue('  speeding  ')
    await wrapper.get('[data-testid="admin-ban-until"]').setValue(' 72h ')
    await wrapper.get('[data-testid="admin-ban-form"]').trigger('submit')
    await flushPromises()

    expect(h.issueBan).toHaveBeenCalledWith({ user: UUID, reason: 'speeding', until: '72h' })
    expect(wrapper.get('[data-testid="admin-ban-outcome"]').text()).toContain('issued')
  })

  it('revokes by the ban row, precisely', async () => {
    h.bans.mockResolvedValue(bansAnswer())
    h.revokeBan.mockResolvedValue({ revoked: true })
    const wrapper = mountCard()
    await search(wrapper, 'grief3r')

    await wrapper.get('[data-testid="admin-unban"]').trigger('click')

    expect(h.revokeBan).toHaveBeenCalledWith(UUID)
  })

  it('shows a reader everything and offers nothing to press', async () => {
    h.permissions = ['bans:read']
    h.bans.mockResolvedValue(bansAnswer())
    const wrapper = mountCard()
    await search(wrapper, 'grief3r')

    expect(wrapper.get('[data-testid="admin-bans-list"]').text()).toContain('wpm 400 run')
    expect(wrapper.find('[data-testid="admin-ban-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-unban"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-badge-grant-staff"]').exists()).toBe(false)
  })
})
