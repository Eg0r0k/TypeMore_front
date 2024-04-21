import { createRouter, createWebHistory } from 'vue-router'
import TheHome from '@/pages/TheHome.vue'
import { RegistrationPage } from '@/pages/auth/registration'
import { LoginPage } from '@/pages/auth/login'
import { SettingPage } from '@/pages/settings'

const routes = [
  {
    path: '/',
    name: 'home',
    component: TheHome
  },
  {
    path: '/registration',
    name: 'registration',
    component: RegistrationPage
  },
  {
    path: '/progile',
    name: 'profile',
    component: TheHome
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingPage
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage
  }
]
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
