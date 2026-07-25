import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Session status, derived from S1's `/me` query.
 * - `unknown`  — bootstrap in flight, nothing decided yet.
 * - `guest`    — no valid session (silent 401 on `/me`, or a later 401 flip).
 * - `authed`   — `/me` resolved a user.
 */
export type AuthStatus = 'unknown' | 'guest' | 'authed'

/**
 * Holds ONLY the derived session status. The user fetch lifecycle lives entirely
 * in TanStack Query (`meQueryOptions`); this store never duplicates it. The
 * wiring that maps the `/me` query onto `status` lives in `useAuthBootstrap`.
 */
export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('unknown')

  const isAuth = computed(() => status.value === 'authed')
  const isGuest = computed(() => status.value === 'guest')
  const isResolved = computed(() => status.value !== 'unknown')

  const setAuthed = () => {
    status.value = 'authed'
  }
  const setGuest = () => {
    status.value = 'guest'
  }
  const reset = () => {
    status.value = 'unknown'
  }

  return { status, isAuth, isGuest, isResolved, setAuthed, setGuest, reset }
})
