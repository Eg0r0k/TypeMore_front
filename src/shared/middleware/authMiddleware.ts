import router from '@/app/router'
import { useAuthStore } from '@/entities/auth/model/store'

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (requiresAuth && !authStore.isAuth) {
    next({ name: 'login' })
  } else {
    next()
  }
})
