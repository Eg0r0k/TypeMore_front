import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/shared/router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: ROUTE_NAMES.LOGIN,
    component: () => import('@/pages/auth/login/ui.vue'),
    meta: { title: 'Login' }
  },
  {
    path: '/register',
    name: ROUTE_NAMES.REGISTER,
    component: () => import('@/pages/auth/register/ui.vue'),
    meta: { title: 'Register' }
  },
  {
    path: '/verify',
    name: ROUTE_NAMES.VERIFY,
    component: () => import('@/pages/auth/verify/ui.vue'),
    meta: { title: 'Verify email' }
  },
  {
    path: '/reset',
    name: ROUTE_NAMES.RESET,
    component: () => import('@/pages/auth/reset/ui.vue'),
    meta: { title: 'Reset password' }
  },
  {
    path: '/reset/confirm',
    name: ROUTE_NAMES.RESET_CONFIRM,
    component: () => import('@/pages/auth/reset-confirm/ui.vue'),
    meta: { title: 'Set new password' }
  },
  {
    path: '/auth/callback',
    name: ROUTE_NAMES.CALLBACK,
    component: () => import('@/pages/auth/callback/ui.vue'),
    meta: { title: 'Signing in…' }
  }
]
