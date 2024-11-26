import router from '@/app/router'
import { useAuthStore } from '@/entities/auth/model/store'

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.matched.some((record) => record.meta.requiresAuth) && !authStore.isAuth) {
    return next({ name: 'login' })
  }
  next()
})
