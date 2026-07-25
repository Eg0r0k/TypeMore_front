import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('@/pages/home/ui.vue')
  }
]
