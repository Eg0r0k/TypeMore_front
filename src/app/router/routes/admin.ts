import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'
import { meQueryOptions, queryClient } from '@shared/api'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/pages/admin/ui.vue'),
    // Mirrors the server's invisibility contract (docs/MODERATION.md): a
    // caller without a permission gets the not-found page AT THIS URL — not a
    // login bounce, which would confirm the subtree exists.
    beforeEnter: async (to) => {
      // A guest's rejected `/me` collapses to null: the same nothing an
      // unauthorized account gets.
      const me = await queryClient.ensureQueryData(meQueryOptions()).catch(() => null)
      if (me !== null && me.permissions.length > 0) return true
      return {
        name: ROUTE_NAMES.ERROR,
        params: { pathMatch: to.path.slice(1).split('/') },
        query: to.query,
        hash: to.hash
      }
    },
    // NOT a `redirect` child: a record-level redirect rewrites the URL before
    // the guard runs, which would show a refused prober that /admin forwards
    // somewhere — the root serves the inbox in place instead.
    children: [
      {
        path: '',
        name: ROUTE_NAMES.ADMIN,
        component: () => import('@/pages/admin/reports/ui.vue'),
        meta: { title: 'Admin' }
      },
      {
        path: 'reports',
        name: ROUTE_NAMES.ADMIN_REPORTS,
        component: () => import('@/pages/admin/reports/ui.vue'),
        meta: { title: 'Admin' }
      },
      {
        path: 'players',
        name: ROUTE_NAMES.ADMIN_PLAYERS,
        component: () => import('@/pages/admin/players/ui.vue'),
        meta: { title: 'Admin' }
      },
      {
        path: 'runs',
        name: ROUTE_NAMES.ADMIN_RUNS,
        component: () => import('@/pages/admin/runs/ui.vue'),
        meta: { title: 'Admin' }
      }
    ]
  }
]
