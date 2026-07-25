import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { boardPageQueryOptions, type BoardEntry, type BoardPage } from '@shared/api'

export interface BoardFeed {
  /** Every page loaded so far, flattened, in rank order. */
  readonly entries: ComputedRef<readonly BoardEntry[]>
  /** Nothing on screen yet and the first page is in flight. */
  readonly isLoading: ComputedRef<boolean>
  /** Rows are on screen and a further page is in flight. */
  readonly isLoadingMore: ComputedRef<boolean>
  readonly isError: ComputedRef<boolean>
  /** The last loaded page handed back a `nextCursor`. */
  readonly hasMore: ComputedRef<boolean>
  readonly loadMore: () => void
  readonly retry: () => void
}

/** Cache/lookup key for the first page, whose cursor is absent. */
const FIRST = ''

/**
 * A ranking, accumulated across keyset pages.
 *
 * Pagination is FORWARD-ONLY by design: the cursor is an opaque token over
 * `(score, achieved_at, user_id)` and there is no page-back token, so this
 * appends rather than paging. Each cursor is its own query — its own cache
 * entry, its own staleness — and the visible list is the concatenation of the
 * ones fetched so far, held here rather than in the cache because "how far the
 * user has scrolled" is view state, not server state.
 *
 * Keyed by cursor rather than pushed onto an array, so a refetch of a page
 * already shown replaces it instead of duplicating every row on it.
 */
export function useBoardFeed(bucket: Ref<string>): BoardFeed {
  /** Cursors requested so far, in load order. `undefined` is the first page. */
  const cursors = ref<(string | undefined)[]>([undefined])
  const pages = ref(new Map<string, BoardPage>())

  const cursor = computed(() => cursors.value[cursors.value.length - 1])
  const query = useQuery(computed(() => boardPageQueryOptions(bucket.value, cursor.value)))

  // A different bucket is a different board: the old rows would sit under the
  // new board's ranks until its first page landed.
  watch(bucket, () => {
    cursors.value = [undefined]
    pages.value.clear()
  })

  watch(
    [() => query.data.value, cursor],
    ([page, at]) => {
      // The server echoes the bucket; a page for the board we just left is not
      // ours to show.
      if (page === undefined || page.bucket !== bucket.value) return
      pages.value.set(at ?? FIRST, page)
    },
    { immediate: true }
  )

  const lastLoaded = computed(() => pages.value.get(cursor.value ?? FIRST))

  const entries = computed<readonly BoardEntry[]>(() =>
    cursors.value.flatMap((at) => pages.value.get(at ?? FIRST)?.entries ?? [])
  )

  const loadMore = (): void => {
    const next = lastLoaded.value?.nextCursor
    if (next === undefined) return
    cursors.value.push(next)
  }

  return {
    entries,
    isLoading: computed(() => pages.value.size === 0 && query.isPending.value),
    isLoadingMore: computed(() => pages.value.size > 0 && query.isPending.value),
    isError: computed(() => query.isError.value),
    // A cursor already requested but not yet answered is a page still coming:
    // the affordance must survive its own click, or "load more" flickers out of
    // existence for the length of the request.
    hasMore: computed(() =>
      lastLoaded.value === undefined
        ? cursor.value !== undefined
        : lastLoaded.value.nextCursor !== undefined
    ),
    loadMore,
    retry: () => {
      void query.refetch()
    }
  }
}
