import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

/**
 * Friends. Today the page is one working half — finding a player by name —
 * because the friendship itself does not exist yet on either side of the wire:
 * `GET /users?q=` is implemented and there is no `POST /friends` to follow it
 * with. The page says so rather than offering a button that cannot work.
 *
 * Deliberately NOT `requiresAuth`, for the same reason `/profile` is not: the
 * search it hosts is a public, sessionless endpoint, and bouncing an anonymous
 * visitor to /login would gate a page that works perfectly well without one.
 * When the friends list arrives it can render its own signed-out state, which
 * is what /profile already does.
 */
export const friendsRoutes: RouteRecordRaw[] = [
  {
    path: '/friends',
    name: ROUTE_NAMES.FRIENDS,
    component: () => import('@/pages/friends/ui.vue'),
    meta: { title: 'Friends' }
  }
]
