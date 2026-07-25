import { watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { meQueryOptions } from '@shared/api'
import { useAuthStore } from './store'

/**
 * Bootstraps the session by wiring the `/me` query onto the auth store.
 * Call ONCE from the app root (`App.vue`). TanStack owns the fetch; we only
 * derive `status`:
 * - success            → `authed`
 * - error (incl. 401)  → `guest`, silently (no toast; `/me` never surfaces one)
 *
 * Because `me` is the session's source of truth, a LATER 401 (a refetch after a
 * mutation invalidation, or an expired cookie) re-enters the error branch and
 * flips `status` back to `guest`.
 */
export function useAuthBootstrap() {
  const store = useAuthStore()
  const query = useQuery(meQueryOptions())

  watch(
    [() => query.isSuccess.value, () => query.isError.value],
    ([ok, errored]) => {
      if (ok) store.setAuthed()
      else if (errored) store.setGuest()
    },
    { immediate: true }
  )

  return query
}

/**
 * Reads the current user from the `/me` cache for display purposes (e.g. the
 * header). Does not own the fetch — it shares the same query the bootstrap
 * started, so no extra request is issued.
 */
export function useCurrentUser() {
  return useQuery(meQueryOptions())
}
