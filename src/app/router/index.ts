import { createRouter, createWebHistory, RouteLocationNormalizedLoaded } from 'vue-router'
import { MainPage } from '@/pages/home'
import { handleModalClose } from '@/shared/middleware/modalGuard'
import { setPageTitle } from '@/shared/middleware/pageTitle'
import { checkAuth } from '@/shared/middleware/authMiddleware'

const routes = [
  {
    path: '/',
    name: 'home',
    component: MainPage
  },
  {
    path: '/registration',
    name: 'registration',
    component: () => import('@pages/auth/registration/ui.vue'),
    meta: { title: 'Registration' }
  },
  {
    path: '/servers',
    name: 'servers',
    component: () => import('@pages/servers/ui.vue'),
    meta: { title: 'Servers' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/pages/profile/ui.vue'),
    meta: { requiresAuth: true, title: 'Profile' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@pages/settings/ui.vue'),
    meta: { title: 'Settings' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@pages/auth/login/ui.vue'),
    meta: { title: 'Login' }
  },
  {
    path: '/themes',
    name: 'themes',
    component: () => import('@/pages/themes/ui.vue'),
    meta: { title: 'Theme' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'error',
    component: () => import('@/pages/error/ui.vue'),
    meta: { title: 'Ooops...' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})
//?Mb delete later
router.beforeEach((to, from, next) => {
  window.scrollTo(0, 0)
  next()
})
router.beforeEach((to, from, next) => {
  handleModalClose(to, from, next)
})
router.beforeEach((to, from, next) => {
  checkAuth(to, from, next)
})
router.beforeEach((to: RouteLocationNormalizedLoaded) => {
  setPageTitle(to)
})

export default router
