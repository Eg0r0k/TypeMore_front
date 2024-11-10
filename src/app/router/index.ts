import { createRouter, createWebHistory, RouteLocationNormalizedLoaded } from 'vue-router'
import { RegistrationPage } from '@pages/auth/registration'
import { LoginPage } from '@pages/auth/login'
import { SettingPage } from '@pages/settings'
import { ServersPage } from '@pages/servers'
import { ThemePage } from '@/pages/themes'
import { MainPage } from '@/pages/home'
import { ProfilePage } from '@/pages/profile'
import { useTitle } from '@vueuse/core'
import { ErrorPage } from '@/pages/error'

const routes = [
  {
    path: '/',
    name: 'home',
    component: MainPage
  },
  {
    path: '/registration',
    name: 'registration',
    component: RegistrationPage,
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
    component: ProfilePage,
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
    component: LoginPage,
    meta: { title: 'Login' }
  },
  {
    path: '/themes',
    name: 'themes',
    component: ThemePage,
    meta: { title: 'Theme' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'error',
    component: ErrorPage 

  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})
router.beforeEach((to: RouteLocationNormalizedLoaded, from) => {
  const title = to.meta.title ? `Type More | ${to.meta.title}` : 'Type More | Typing speed training'
  useTitle(title)
})
export default router
