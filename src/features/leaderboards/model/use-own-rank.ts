import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { boardMeQueryOptions, isApiError, type BoardEntry, type BoardMe } from '@shared/api'
import logger from '@shared/lib/helpers/logger'

export interface OwnRank {
  /** The caller's entry, or `null` for "asked, holds no slot here". */
  readonly ownEntry: ComputedRef<BoardEntry | null>
  /** Whether the own-rank strip has anything honest to say. */
  readonly isOwnRankVisible: ComputedRef<boolean>
  /** `userId` of the caller when known — the board marks that row as theirs. */
  readonly selfUserId: ComputedRef<string | undefined>
}

/**
 * The caller's own slot on the current board.
 *
 * Two answers are NOT errors and must never reach the error state:
 *
 * - `null` — a `204`. The caller was identified and holds no visible slot here
 *   (including a banned caller, who gets the same answer as someone who never
 *   played it: a board must not leak who is banned, not even to them).
 * - `401` — a signed-out visitor. `/{bucket}/me` is the one route in a public
 *   subtree that wants a session, and it says so itself rather than dragging
 *   the board behind auth middleware. A red box on a public page because
 *   nobody is logged in would be wrong, so the strip simply does not render.
 *
 * Anything else that fails also leaves the strip out — it is a secondary read
 * next to the board itself — but it is logged, because a 500 on `/me` is a real
 * problem and swallowing it silently is how it stays one.
 */
export function useOwnRank(bucket: Ref<string>): OwnRank {
  // The strip reads only the entry, so the cache subscription narrows to it —
  // consumer-side, because the factory's shape is the whole response.
  const query = useQuery(
    computed(() => ({
      ...boardMeQueryOptions(bucket.value),
      select: (me: BoardMe | null) => me?.entry ?? null
    }))
  )

  const isGuest = computed(() => {
    const error = query.error.value
    return isApiError(error) && error.status === 401
  })

  const ownEntry = computed<BoardEntry | null>(() => query.data.value ?? null)

  const isOwnRankVisible = computed(() => query.isSuccess.value)

  // Logging is a side effect and has no business inside a computed.
  watch(
    () => query.error.value,
    (error) => {
      if (error === null || error === undefined || isGuest.value) return
      logger.warn('leaderboards: own rank unavailable', error)
    }
  )

  return {
    ownEntry,
    isOwnRankVisible,
    selfUserId: computed(() => ownEntry.value?.userId)
  }
}
