import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

export const profileRoutes: RouteRecordRaw[] = [
  {
    path: '/profile',
    name: ROUTE_NAMES.PROFILE,
    component: () => import('@/pages/profile/ui.vue'),
    meta: { requiresAuth: true, title: 'Profile' }
  }
]
