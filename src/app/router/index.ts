import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { lobbyMiddleware } from './middleware/lobby.middleware'
import { authMiddleware } from './middleware/auth.middleware'
import { titleMiddleware } from './middleware/title.middleware'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    if (to.matched[0]?.name !== from.matched[0]?.name) return { top: 0, behavior: 'smooth' }
    return false
  }
})

router.beforeEach(lobbyMiddleware)
router.beforeEach(authMiddleware)
router.beforeEach(titleMiddleware)

export default router
