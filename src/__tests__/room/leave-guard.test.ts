/**
 * The navigation lock of a held seat: while the match session has a room,
 * internal navigation away from /room is refused (the seat would stay occupied
 * behind the player's back) and a warning alert names the way out. Both stores
 * are module-mocked — the guard is a plain async function, no router needed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { ROUTE_NAMES } from '@/shared/router'

const h = vi.hoisted(() => ({
  session: { room: null as unknown, resumeAttempted: false, init: async () => {} },
  toastWarning: vi.fn()
}))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.session
}))
// Sonner is the app's one live toast system — the warning must land there.
vi.mock('@/shared/ui/sonner', () => ({
  toast: { warning: h.toastWarning }
}))

import { lobbyMiddleware } from '@/app/router/middleware/lobby.middleware'

const to = (name: string) => ({ name }) as unknown as RouteLocationNormalized

beforeEach(() => {
  h.session.room = null
  h.toastWarning.mockClear()
})

describe('leaving a held seat', () => {
  it('refuses internal navigation while the session holds a room, with a warning', async () => {
    h.session.room = { code: 'ABCD' }
    await expect(lobbyMiddleware(to(ROUTE_NAMES.HOME))).resolves.toBe(false)
    expect(h.toastWarning).toHaveBeenCalledOnce()
  })

  it('lets the post-leave redirect through — the room is already gone', async () => {
    await expect(lobbyMiddleware(to(ROUTE_NAMES.SERVERS))).resolves.toBeUndefined()
    expect(h.toastWarning).not.toHaveBeenCalled()
  })

  it('still gates direct /room entry without a room', async () => {
    h.session.resumeAttempted = false
    await expect(lobbyMiddleware(to(ROUTE_NAMES.ROOM))).resolves.toEqual({
      name: ROUTE_NAMES.SERVERS
    })
  })

  it('passes /room straight through while seated', async () => {
    h.session.room = { code: 'ABCD' }
    await expect(lobbyMiddleware(to(ROUTE_NAMES.ROOM))).resolves.toBeUndefined()
  })
})
