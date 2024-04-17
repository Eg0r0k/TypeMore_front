import { createRouter, createWebHistory } from 'vue-router'
import TheHome from '@/pages/TheHome.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: TheHome
  },
  {
    path: '/progile',
    name: 'profile',
    component: TheHome
  },
  {
    path: '/settings',
    name: 'settings',
    component: TheHome
  }
]
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
