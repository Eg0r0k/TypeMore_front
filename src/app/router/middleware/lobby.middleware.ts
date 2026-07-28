import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'
import { useMatchSessionStore } from '@/entities/match'
import { AlertType, useAlertStore } from '@/entities/alert'
import { i18n } from '@app/i18n'

// Global guard: `/room` is only reachable while the match session actually has
// a room (a `room_state` snapshot). Deep links and stale history entries land
// on /servers. A hard reload first lets the session present its stored resume
// token (Δ2): the reclaimed room_state races this guard, so wait briefly.
//
// The guard also works the OTHER way: while the session holds a room, internal
// navigation is refused. A seat is not a browser tab — walking to the home page
// leaves it occupied (chat scrolling, host free to start a match the player
// will forfeit), so the one way out is the leave button, which drops the seat
// FIRST and only then routes away. Reload/close are the transport's problem
// (resume token, stale-seat forfeit), not this guard's.
export async function lobbyMiddleware(
  to: RouteLocationNormalized
): Promise<RouteLocationRaw | boolean | undefined> {
  if (to.name !== ROUTE_NAMES.ROOM) {
    const session = useMatchSessionStore()
    if (!session.room) return undefined
    useAlertStore().addAlert({
      type: AlertType.Warning,
      msg: i18n.global.t('room.leaveFirst')
    })
    return false
  }
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
