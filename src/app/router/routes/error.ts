import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

export const errorRoutes: RouteRecordRaw[] = [
  {
    path: '/:pathMatch(.*)*',
    name: ROUTE_NAMES.ERROR,
    component: () => import('@/pages/error/ui.vue'),
    meta: { title: 'Ooops...' }
  }
]
