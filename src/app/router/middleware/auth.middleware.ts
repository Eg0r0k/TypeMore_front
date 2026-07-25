import type { RouteLocationNormalized } from 'vue-router'
import { meQueryOptions, queryClient } from '@shared/api'
import { useAuthStore } from '@/entities/auth'
import { routeLocation } from '@/app/router/route-locations'

// Global guard: routes flagged `meta.requiresAuth` resolve the session before
// deciding. We can't trust `status` on a hard load (bootstrap in App.vue has not
// run yet), so we resolve `/me` through the standalone query client (S1's
// documented prefetch client) and mirror the outcome onto the store. A cached
// hit is instant; a 401 fails fast (no retry on 4xx) and redirects to login.
export async function authMiddleware(to: RouteLocationNormalized) {
  if (!to.matched.some((record) => record.meta.requiresAuth)) return

  const authStore = useAuthStore()
  try {
    await queryClient.ensureQueryData(meQueryOptions())
    authStore.setAuthed()
  } catch {
    authStore.setGuest()
    return routeLocation.login()
  }
}
