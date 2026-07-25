import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { BucketInfo } from '@shared/api'
import { mostPopulatedBucket } from './bucket'

export interface BucketSelection {
  /** The bucket actually being displayed, or `undefined` while/if there is none. */
  readonly selected: ComputedRef<string | undefined>
  /** Move to another board. A user choice is history, so this pushes. */
  readonly select: (bucket: string) => void
}

/**
 * Which board is on screen, kept in the URL.
 *
 * `?bucket=` is the source of truth when it names a board that exists — that is
 * what makes a board link shareable. A `?bucket=` the catalogue does not
 * contain (renamed shape, stale link, typo) falls back to the most populated
 * one AND is rewritten, because a URL that names one board while the page shows
 * another is a URL that lies to whoever copies it next.
 *
 * The rewrite is `replace`, not `push`: correcting our own address is not a
 * navigation the user made, and a history entry there would make Back a no-op
 * loop.
 */
export function useBucketSelection(catalogue: Ref<BucketInfo[] | undefined>): BucketSelection {
  const route = useRoute()
  const router = useRouter()

  const requested = computed<string | undefined>(() =>
    typeof route.query.bucket === 'string' ? route.query.bucket : undefined
  )

  const isKnown = (bucket: string | undefined): boolean =>
    bucket !== undefined && (catalogue.value?.some((info) => info.bucket === bucket) ?? false)

  const selected = computed<string | undefined>(() => {
    const buckets = catalogue.value
    if (buckets === undefined || buckets.length === 0) return undefined
    return isKnown(requested.value) ? requested.value : mostPopulatedBucket(buckets)
  })

  watch(
    [selected, requested],
    ([shown, asked]) => {
      // Nothing to correct until the catalogue has resolved a board, and an
      // address with no `?bucket=` at all is not claiming anything false.
      if (shown === undefined || asked === undefined || asked === shown) return
      void router.replace({ query: { ...route.query, bucket: shown } })
    },
    { immediate: true }
  )

  const select = (bucket: string): void => {
    if (bucket === requested.value) return
    void router.push({ query: { ...route.query, bucket } })
  }

  return { selected, select }
}
