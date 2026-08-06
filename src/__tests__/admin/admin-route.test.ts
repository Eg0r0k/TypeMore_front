/**
 * The /admin guard mirrors the server's invisibility contract
 * (docs/MODERATION.md): no permission — including no session at all — answers
 * the not-found page AT THE REQUESTED URL, never a login redirect, so a prober
 * cannot learn the subtree exists.
 */
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

const h = vi.hoisted(() => ({ me: vi.fn() }))

vi.mock('@shared/api', () => ({
  meQueryOptions: () => ({ queryKey: ['auth', 'me'] }),
  queryClient: { ensureQueryData: h.me }
}))

// Navigation resolves lazy route components, so the real pages (and their
// import chains) are stubbed out — the guard is the thing under test.
vi.mock('@/pages/admin/ui.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/pages/admin/reports/ui.vue', () => ({ default: { template: '<div />' } }))

const { adminRoutes } = await import('@/app/router/routes/admin')
const { ROUTE_NAMES } = await import('@/shared/router')

const user = (permissions: string[]) => ({
  id: 'u',
  displayName: 'mod',
  createdAt: '',
  restricted: false,
  profilePublic: true,
  keyboardPublic: false,
  permissions
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: ROUTE_NAMES.HOME, component: { template: '<div />' } },
      ...adminRoutes,
      {
        path: '/:pathMatch(.*)*',
        name: ROUTE_NAMES.ERROR,
        component: { template: '<div />' }
      }
    ]
  })
}

describe('the /admin guard', () => {
  // No beforeEach reset: every test installs its own `/me` implementation, and
  // resetting the fn makes this vitest resurface the guest test's caught
  // rejection as an unhandled one.
  it('lets a holder of any permission through', async () => {
    h.me.mockResolvedValue(user(['reports:read']))
    const router = makeRouter()

    await router.push('/admin/reports')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ADMIN_REPORTS)
  })

  it('answers a plain player with not-found at the same URL', async () => {
    h.me.mockResolvedValue(user([]))
    const router = makeRouter()

    await router.push('/admin/reports')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ERROR)
    expect(router.currentRoute.value.fullPath).toBe('/admin/reports')
  })

  it('answers a guest with the same nothing, not a login bounce', async () => {
    // Lazy rejection: mockRejectedValue creates the rejected promise at setup,
    // before the guard can attach a handler, and trips vitest's detector.
    h.me.mockImplementation(() => Promise.reject(new Error('401')))
    const router = makeRouter()

    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ERROR)
    expect(router.currentRoute.value.fullPath).toBe('/admin')
  })

  it('serves the inbox at the admin root without rewriting the URL', async () => {
    h.me.mockResolvedValue(user(['reports:read', 'reports:write']))
    const router = makeRouter()

    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.ADMIN)
    expect(router.currentRoute.value.fullPath).toBe('/admin')
  })
})
