import { createRouter, createWebHistory, RouteLocationNormalizedLoaded } from 'vue-router'
import { SettingPage } from '@pages/settings'
import { ServersPage } from '@pages/servers'
import { MainPage } from '@/pages/home'
import { useTitle } from '@vueuse/core'

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
    component: ServersPage,
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
    component: SettingPage,
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
    component: () => import('@/pages/error/ui.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})
// router.beforeEach((to: RouteLocationNormalizedLoaded) => {
//   const title = to.meta.title ? `Type More | ${to.meta.title}` : 'Type More | Typing speed training'
//   useTitle(title)
// })
export default router
