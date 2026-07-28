import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

export const profileRoutes: RouteRecordRaw[] = [
  {
    path: '/profile',
    name: ROUTE_NAMES.PROFILE,
    component: () => import('@/pages/profile/ui.vue'),
    // Deliberately NOT requiresAuth: the page renders a sign-in hint for an
    // anonymous visitor instead of bouncing them to /login — the URL stays
    // shareable and honest about what lives here.
    meta: { title: 'Profile' }
  }
]
