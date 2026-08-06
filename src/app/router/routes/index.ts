import type { RouteRecordRaw } from 'vue-router'
import { homeRoutes } from './home'
import { authRoutes } from './auth'
import { serversRoutes } from './servers'
import { roomRoutes } from './room'
import { profileRoutes } from './profile'
import { errorRoutes } from './error'
import { matchRoutes } from './match'
import { boardsRoutes } from './boards'
import { friendsRoutes } from './friends'
import { adminRoutes } from './admin'

// `errorRoutes` (the catch-all) MUST stay last so real routes match first.
export const routes: RouteRecordRaw[] = [
  ...homeRoutes,
  ...authRoutes,
  ...serversRoutes,
  ...roomRoutes,
  ...profileRoutes,
  ...matchRoutes,
  ...boardsRoutes,
  ...friendsRoutes,
  ...adminRoutes,
  ...errorRoutes
]

export {
  homeRoutes,
  authRoutes,
  serversRoutes,
  roomRoutes,
  profileRoutes,
  matchRoutes,
  boardsRoutes,
  friendsRoutes,
  adminRoutes,
  errorRoutes
}
