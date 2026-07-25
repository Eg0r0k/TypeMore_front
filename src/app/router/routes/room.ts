import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

// The multiplayer room (lobby → countdown → match → results). Gated by
// `lobbyMiddleware`: entering without an active room redirects to /servers.
export const roomRoutes: RouteRecordRaw[] = [
  {
    path: '/room',
    name: ROUTE_NAMES.ROOM,
    component: () => import('@/pages/room/ui.vue'),
    meta: { title: 'Room' }
  }
]
