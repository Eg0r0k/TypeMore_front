import { RouteLocationNormalizedLoaded } from 'vue-router'
import { useAuthStore } from '@/entities/auth/model/store'

export function checkAuth(
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  next: any
) {
  const authStore = useAuthStore()
  if (to.matched.some((record) => record.meta.requiresAuth) && !authStore.isAuth) {
    return next({ name: 'login' })
  }
  next()
}
