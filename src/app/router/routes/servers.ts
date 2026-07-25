import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

export const serversRoutes: RouteRecordRaw[] = [
  {
    path: '/servers',
    name: ROUTE_NAMES.SERVERS,
    component: () => import('@/pages/servers/ui.vue'),
    meta: { title: 'Servers' }
  }
]
