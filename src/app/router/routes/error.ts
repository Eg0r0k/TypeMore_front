import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

export const errorRoutes: RouteRecordRaw[] = [
  {
    path: '/:pathMatch(.*)*',
    name: ROUTE_NAMES.ERROR,
    component: () => import('@/pages/error/ui.vue'),
    meta: { title: 'Ooops...' }
  }
]
