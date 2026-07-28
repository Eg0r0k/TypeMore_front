import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { quoteCorpusLang, quotePageQueryOptions, type QuoteMeta, type QuotePage } from '@shared/api'
import type { QuoteGroupFilter } from './use-boards-selection'

export interface QuoteFeed {
  /** Every page loaded so far, flattened, in index order. */
  readonly quotes: ComputedRef<readonly QuoteMeta[]>
  /** Nothing on screen yet and the first page is in flight. */
  readonly isLoading: ComputedRef<boolean>
  /** Rows are on screen and a further page is in flight. */
  readonly isLoadingMore: ComputedRef<boolean>
  readonly isError: ComputedRef<boolean>
  readonly hasMore: ComputedRef<boolean>
  readonly loadMore: () => void
  readonly retry: () => void
}

/** Cache/lookup key for the first page, whose cursor is absent. */
const FIRST = ''

/**
 * The quote index, accumulated across keyset pages — the same shape as the
 * board feed, over `GET /quotes`.
 *
 * The language is rewritten through `quoteCorpusLang` HERE, once, so a rail
 * selection of `russian_50k` walks the `russian` corpus — the same corpus a
 * quote draw for it would hit. Filters reset the walk: two filters are two
 * different walks and must not concatenate.
 */
export function useQuoteFeed(
  lang: Ref<string | undefined>,
  group: Ref<QuoteGroupFilter>
): QuoteFeed {
  const corpus = computed(() =>
    lang.value === undefined ? undefined : quoteCorpusLang(lang.value)
  )
  const filter = computed(() => ({
    ...(corpus.value === undefined ? {} : { lang: corpus.value }),
    ...(group.value === 'all' ? {} : { group: group.value })
  }))

  /** Cursors requested so far, in load order. `undefined` is the first page. */
  const cursors = ref<(string | undefined)[]>([undefined])
  const pages = ref(new Map<string, QuotePage>())

  const cursor = computed(() => cursors.value[cursors.value.length - 1])
  const query = useQuery(
    computed(() => quotePageQueryOptions({ ...filter.value, cursor: cursor.value }))
  )

  watch(filter, () => {
    cursors.value = [undefined]
    pages.value.clear()
  })

  watch(
    [() => query.data.value, cursor],
    ([page, at]) => {
      // `isPending` guards the filter-switch race: the cursors were just
      // reset, but `data` may still hold the OLD filter's page for a tick.
      // (`QuotePage` has no filter echo to check, unlike a board page.)
      if (page === undefined || query.isPending.value) return
      pages.value.set(at ?? FIRST, page)
    },
    { immediate: true }
  )

  const lastLoaded = computed(() => pages.value.get(cursor.value ?? FIRST))

  const quotes = computed<readonly QuoteMeta[]>(() =>
    cursors.value.flatMap((at) => pages.value.get(at ?? FIRST)?.quotes ?? [])
  )

  const loadMore = (): void => {
    const next = lastLoaded.value?.nextCursor
    if (next === undefined) return
    cursors.value.push(next)
  }

  return {
    quotes,
    isLoading: computed(() => pages.value.size === 0 && query.isPending.value),
    isLoadingMore: computed(() => pages.value.size > 0 && query.isPending.value),
    isError: computed(() => query.isError.value),
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
