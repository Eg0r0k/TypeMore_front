import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

// Dev-only match screen (Phase B ghost-seam harness): registered in dev builds
// only and linked from nowhere. The real lobby/match flow replaces it in C1.
export const matchRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: '/match',
        name: ROUTE_NAMES.MATCH,
        component: () => import('@/pages/match/ui.vue')
      }
    ]
  : []
