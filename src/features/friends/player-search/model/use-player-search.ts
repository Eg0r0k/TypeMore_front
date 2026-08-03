import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useQuery } from '@tanstack/vue-query'
import { gatedBy } from '@shared/lib/helpers/gated-query'

import {
  isApiError,
  isSearchable,
  userSearchQueryOptions,
  SEARCH_MIN_QUERY_LEN,
  type PublicProfile
} from '@shared/api'

/**
 * Debounce for query-as-you-type. The endpoint is rate-limited server-side and
 * every keystroke is a fresh cache key, so the field must not turn a typed name
 * into one request per letter. 250ms is under the threshold where a search box
 * starts feeling like it is lagging, and it is longer than any burst of typing
 * within one word.
 */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * What the results area should render. A search box has more states than
 * "loading / data / error", and collapsing them is how one ends up showing
 * "nobody found" to someone who has typed two letters.
 *
 * - `idle`     — nothing typed yet.
 * - `too-short` — typed, but below the server's minimum. Not an error: the
 *                 question is simply not askable yet, and saying so is kinder
 *                 than a spinner that resolves into nothing.
 * - `searching` — a request is in flight and there is nothing to show under it.
 * - `results`   — hits, possibly stale ones while a refinement lands.
 * - `empty`     — the question was asked and answered: nobody.
 * - `error`     — the request failed.
 */
export type SearchState = 'idle' | 'too-short' | 'searching' | 'results' | 'empty' | 'error'

export interface PlayerSearch {
  readonly query: Ref<string>
  readonly state: ComputedRef<SearchState>
  readonly hits: ComputedRef<readonly PublicProfile[]>
  /** True while a refinement is in flight over hits already on screen. */
  readonly refreshing: ComputedRef<boolean>
  readonly errorMessage: ComputedRef<string | null>
  readonly minLength: number
}

/**
 * The player-search box's model: a debounced query, its gated request, and the
 * one state the view switches on.
 *
 * The query is gated by `isSearchable`, the client-side twin of the server's
 * own 400 — a query it would refuse is never sent. Gating lives here rather
 * than in the query factory because that is this codebase's convention: a
 * factory describes a request, the consumer decides whether to make it.
 */
export function usePlayerSearch(): PlayerSearch {
  const query = ref('')
  const debounced = refDebounced(query, SEARCH_DEBOUNCE_MS)

  // The RAW query decides "too short", the DEBOUNCED one decides what is
  // asked. Reading the raw one here means the hint appears as the player
  // types rather than a quarter-second after they stop.
  const askable = computed(() => isSearchable(debounced.value))

  const search = useQuery(
    computed(() => gatedBy(userSearchQueryOptions(debounced.value), askable.value))
  )

  const hits = computed<readonly PublicProfile[]>(() =>
    askable.value ? (search.data.value?.users ?? []) : []
  )

  const refreshing = computed(() => search.isFetching.value && hits.value.length > 0)

  const state = computed<SearchState>(() => {
    if (query.value.trim().length === 0) return 'idle'
    if (!isSearchable(query.value)) return 'too-short'
    // The debounce window: the raw query is askable but the request for it has
    // not been issued yet. Showing the previous query's "nobody" here would be
    // an answer to a question the player has already moved on from.
    if (!askable.value) return 'searching'
    if (search.isError.value) return 'error'
    if (hits.value.length > 0) return 'results'
    return search.isPending.value || search.isFetching.value ? 'searching' : 'empty'
  })

  const errorMessage = computed(() => {
    const error = search.error.value
    if (!error) return null
    return isApiError(error) ? error.message : String(error)
  })

  return { query, state, hits, refreshing, errorMessage, minLength: SEARCH_MIN_QUERY_LEN }
}
