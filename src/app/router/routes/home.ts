import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

export const homeRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('@/pages/home/ui.vue')
  }
]
