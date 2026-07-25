import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'
import { useMatchSessionStore } from '@/entities/match'

// Global guard: `/room` is only reachable while the match session actually has
// a room (a `room_state` snapshot). Deep links and stale history entries land
// on /servers. A hard reload first lets the session present its stored resume
// token (Δ2): the reclaimed room_state races this guard, so wait briefly.
export async function lobbyMiddleware(
  to: RouteLocationNormalized
): Promise<RouteLocationRaw | undefined> {
  if (to.name !== ROUTE_NAMES.ROOM) return undefined
  const session = useMatchSessionStore()
  if (session.room) return undefined
  await session.init()
  if (session.resumeAttempted) {
    const deadline = Date.now() + 1500
    while (!session.room && Date.now() < deadline) {
      // Executor form on purpose: tsconfig lib/engines predate Promise.withResolvers (ES2024/Node 22).
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  return session.room ? undefined : { name: ROUTE_NAMES.SERVERS }
}
