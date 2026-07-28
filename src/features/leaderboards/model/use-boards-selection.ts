import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import { QuoteLengthGroupSchema, type BucketInfo, type QuoteLengthGroup } from '@shared/api'
import { mostPopulatedBucket } from './bucket'
import { bucketForLanguage } from './rail'

/** Where the board's text comes from — the rail's second group. */
export type BoardsSource = 'random' | 'quotes'

/** The quote picker's length filter. `all` is the absence of one. */
export type QuoteGroupFilter = QuoteLengthGroup | 'all'

/** What the main column shows. */
export type BoardsView =
  /** A board: the controls, the pinned row, the table. */
  | 'board'
  /** The quote picker for the selected language. */
  | 'quote-picker'
  /** A language with no boards yet: the muted chips and an honest line. */
  | 'no-language-boards'

export interface BoardsSelection {
  /** The bucket actually being displayed, or `undefined` while/if there is none. */
  readonly selected: ComputedRef<string | undefined>
  readonly view: ComputedRef<BoardsView>
  /** The rail's language, derived from the board on screen or from `?lang=`. */
  readonly language: ComputedRef<string | undefined>
  readonly source: ComputedRef<BoardsSource>
  /** The quote picker's length filter. */
  readonly group: ComputedRef<QuoteGroupFilter>
  /** Move to another board. A user choice is history, so this pushes. */
  readonly select: (bucket: string) => void
  readonly selectLanguage: (lang: string) => void
  readonly selectSource: (source: BoardsSource) => void
  readonly selectGroup: (group: QuoteGroupFilter) => void
}

/**
 * Everything the boards page keeps in the URL, so every state of it is a link:
 *
 *   ?bucket=<key>                       one board (language or quote)
 *   ?source=quotes&lang=<key>&group=<g> the quote picker
 *   ?lang=<key>                         a language with no boards yet
 *   (nothing)                           the busiest board
 *
 * `bucket` names a BOARD and wins over the picker params; the actions below
 * write one shape or the other, never both. A `?bucket=` the catalogue does
 * not contain (renamed shape, stale link, typo) falls back to the most
 * populated board AND is rewritten — a URL that names one board while the page
 * shows another lies to whoever copies it next. The rewrite is `replace`:
 * correcting our own address is not a navigation the user made.
 */
export function useBoardsSelection(catalogue: Ref<BucketInfo[] | undefined>): BoardsSelection {
  const route = useRoute()
  const router = useRouter()

  const requestedBucket = computed<string | undefined>(() =>
    typeof route.query.bucket === 'string' ? route.query.bucket : undefined
  )
  const requestedLang = computed<string | undefined>(() =>
    typeof route.query.lang === 'string' ? route.query.lang : undefined
  )
  const wantsQuotes = computed(() => route.query.source === 'quotes')

  const group = computed<QuoteGroupFilter>(() => {
    const raw = route.query.group
    return typeof raw === 'string' &&
      (QuoteLengthGroupSchema.options as readonly string[]).includes(raw)
      ? (raw as QuoteLengthGroup)
      : 'all'
  })

  const isKnown = (bucket: string | undefined): boolean =>
    bucket !== undefined && (catalogue.value?.some((info) => info.bucket === bucket) ?? false)

  const selected = computed<string | undefined>(() => {
    const buckets = catalogue.value
    if (buckets === undefined) return undefined
    if (isKnown(requestedBucket.value)) return requestedBucket.value
    // The picker and the empty-language state are bucketless on purpose; only
    // an address that ASKED for a board (or asked for nothing) gets one picked.
    if (requestedBucket.value === undefined && wantsQuotes.value) return undefined
    if (requestedBucket.value === undefined && requestedLang.value !== undefined) {
      return bucketForLanguage(buckets, requestedLang.value, undefined)
    }
    return mostPopulatedBucket(buckets)
  })

  const infoOf = (bucket: string | undefined): BucketInfo | undefined =>
    catalogue.value?.find((info) => info.bucket === bucket)

  const language = computed<string | undefined>(() => {
    const info = infoOf(selected.value)
    if (info !== undefined && 'lang' in info) return info.lang
    return requestedLang.value
  })

  const source = computed<BoardsSource>(() => (wantsQuotes.value ? 'quotes' : 'random'))

  const view = computed<BoardsView>(() => {
    if (selected.value !== undefined) return 'board'
    if (wantsQuotes.value) return 'quote-picker'
    return 'no-language-boards'
  })

  // Correct an address that names a board the page is not showing. An address
  // with no `?bucket=` at all is not claiming anything false, and the picker
  // and empty-language states legitimately have none.
  watch(
    [selected, requestedBucket],
    ([shown, asked]) => {
      if (asked === undefined || asked === shown) return
      if (shown === undefined) return
      void router.replace({ query: { ...route.query, bucket: shown } })
    },
    { immediate: true }
  )

  /**
   * The page owns exactly these params; anything else in the query (a future
   * `?debug=`, a UTM tag) rides along untouched.
   */
  const withOwn = (own: LocationQueryRaw): LocationQueryRaw => {
    const kept: LocationQueryRaw = {}
    for (const [key, value] of Object.entries(route.query as LocationQuery)) {
      if (key !== 'bucket' && key !== 'source' && key !== 'lang' && key !== 'group') {
        kept[key] = value
      }
    }
    return { ...kept, ...own }
  }

  const push = (own: LocationQueryRaw): void => {
    void router.push({ query: withOwn(own) })
  }

  const select = (bucket: string): void => {
    if (bucket === selected.value && bucket === requestedBucket.value) return
    push({ bucket })
  }

  const openPicker = (lang: string | undefined, at: QuoteGroupFilter): void => {
    push({
      source: 'quotes',
      ...(lang === undefined ? {} : { lang }),
      ...(at === 'all' ? {} : { group: at })
    })
  }

  const selectLanguage = (lang: string): void => {
    if (source.value === 'quotes') {
      openPicker(lang, group.value)
      return
    }
    const bucket = bucketForLanguage(catalogue.value ?? [], lang, selected.value)
    if (bucket !== undefined) {
      push({ bucket })
    } else {
      push({ lang })
    }
  }

  const selectSource = (next: BoardsSource): void => {
    if (next === source.value) return
    if (next === 'quotes') {
      openPicker(language.value, 'all')
      return
    }
    const lang = language.value
    const bucket =
      lang === undefined ? undefined : bucketForLanguage(catalogue.value ?? [], lang, undefined)
    if (bucket !== undefined) {
      push({ bucket })
    } else if (lang !== undefined) {
      push({ lang })
    } else {
      push({})
    }
  }

  const selectGroup = (next: QuoteGroupFilter): void => {
    if (next === group.value && source.value === 'quotes') return
    openPicker(language.value, next)
  }

  return {
    selected,
    view,
    language,
    source,
    group,
    select,
    selectLanguage,
    selectSource,
    selectGroup
  }
}
