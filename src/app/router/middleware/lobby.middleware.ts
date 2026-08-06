import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'
import { useMatchSessionStore } from '@/entities/match'
import { toast } from '@/shared/ui/sonner'
import { i18n } from '@app/i18n'

// Global guard: `/room` is only reachable while the match session actually has
// a room (a `room_state` snapshot). Deep links and stale history entries land
// on /servers. A hard reload first lets the session present its stored resume
// token (Δ2): the reclaimed room_state races this guard, so wait briefly.
//
// One deep link IS honoured: `/room?c=CODE` — the shareable address the room
// page keeps in the URL — joins that room by code, exactly as the join modal
// would. A refused code (gone, full, restricted) lands on /servers with the
// refusal said out loud, never on a roomless /room.
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
    toast.warning(i18n.global.t('room.leaveFirst'))
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
  if (!session.room) {
    // Optional chain: guard tests hand this middleware bare route stubs.
    const raw = to.query?.c
    const code = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''
    if (code !== '') {
      const errorBaseline = session.lastError
      session.joinRoom(code)
      const deadline = Date.now() + 2000
      while (
        !session.room &&
        session.lastError === errorBaseline &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (!session.room) {
        toast.error(i18n.global.t(joinRefusalKey(session.lastError?.code)))
        return { name: ROUTE_NAMES.SERVERS }
      }
    }
  }
  return session.room ? undefined : { name: ROUTE_NAMES.SERVERS }
}

/** The same vocabulary the join modal speaks, for a refusal arriving by link. */
function joinRefusalKey(code: string | undefined): string {
  switch (code) {
    case 'room_not_found':
      return 'servers.join.notFound'
    case 'room_full':
      return 'servers.join.full'
    case 'account_restricted':
      return 'servers.restricted'
    default:
      return 'servers.join.failed'
  }
}
