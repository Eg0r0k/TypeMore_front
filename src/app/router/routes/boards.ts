import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

/**
 * Leaderboards. Public on purpose — a board nobody can read without an account
 * is a board nobody links to, which is the same reasoning the server's
 * `docs/LEADERBOARDS.md` gives for leaving the whole subtree unauthenticated.
 *
 * The bucket lives in the QUERY, not the path: it is a filter over one board
 * view rather than a different page, and a shareable `?bucket=` is what lets
 * someone link the board they are looking at. Replay is its own route so the
 * browser back button returns to the board instead of unwinding a modal.
 */
export const boardsRoutes: RouteRecordRaw[] = [
  {
    path: '/boards',
    name: ROUTE_NAMES.BOARDS,
    component: () => import('@/pages/boards/ui.vue'),
    meta: { title: 'Leaderboards' }
  },
  {
    path: '/replay/:runId',
    name: ROUTE_NAMES.REPLAY,
    component: () => import('@/pages/replay/ui.vue'),
    props: true,
    meta: { title: 'Replay' }
  }
]
