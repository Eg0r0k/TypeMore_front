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
  },
  {
    // Another player's profile, by display name. Public by design — privacy is
    // the SERVER's answer per section (403 profile_closed), and the page
    // renders that answer as a state; a closed profile is a real page, not a
    // 404 (backend docs/PROFILE.md, "Public profiles").
    path: '/u/:name',
    name: ROUTE_NAMES.USER,
    component: () => import('@/pages/user/ui.vue'),
    meta: { title: 'Profile' }
  }
]
