import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  boardAroundQueryOptions,
  boardPageBeforeQueryOptions,
  boardPageQueryOptions,
  type BoardEntry,
  type BoardPage
} from '@shared/api'
import { queryClient } from '@/shared/api/query-client'
import logger from '@shared/lib/helpers/logger'

/**
 * One contiguous run of ranks. `prevCursor` continues it upward (absent when
 * it starts at rank 1), `nextCursor` downward (absent at the board's bottom).
 */
export interface BoardSegment {
  /** Stable identity for v-for keys and the load actions. */
  readonly id: number
  readonly entries: readonly BoardEntry[]
  readonly prevCursor?: string
  readonly nextCursor?: string
}

export interface BoardFeed {
  /** Disjoint, rank-ordered segments. One, until a jump opens a window. */
  readonly segments: ComputedRef<readonly BoardSegment[]>
  /** Every loaded entry, flattened in rank order. */
  readonly entries: ComputedRef<readonly BoardEntry[]>
  /** Nothing on screen yet and the first page is in flight. */
  readonly isLoading: ComputedRef<boolean>
  /** Rows are on screen and a further page is in flight. */
  readonly isLoadingMore: ComputedRef<boolean>
  readonly isError: ComputedRef<boolean>
  /** The LAST segment can continue downward. */
  readonly hasMore: ComputedRef<boolean>
  /** Extend the last segment downward — the tail "load more". */
  readonly loadMore: () => void
  /** Extend one segment upward — the gap row between two segments. */
  readonly loadBefore: (segmentId: number) => void
  /**
   * Make sure the caller's own row is loaded, fetching the around=me window
   * into a new segment when it is not. Resolves to whether the row is (now)
   * in the feed — `false` for a guest, an unranked caller, or a failed fetch.
   */
  readonly ensureSelf: (selfUserId: string) => Promise<boolean>
  readonly retry: () => void
}

interface Segment {
  id: number
  entries: BoardEntry[]
  prevCursor?: string
  nextCursor?: string
}

const firstRank = (s: Segment): number => s.entries[0]?.rank ?? 0
const lastRank = (s: Segment): number => s.entries[s.entries.length - 1]?.rank ?? 0

/**
 * Normalise segments: rank order, and any two that now touch or overlap
 * become one. Dedupe is by USER — a player holds one slot per bucket (the
 * table's primary key), and two fetches at different instants can catch the
 * same player at two ranks; the later-arriving fetch wins.
 *
 * Exported for the seam property test: this is the function that must never
 * drop or double a row, whatever order the windows landed in.
 */
export const mergeSegments = (input: readonly Segment[]): Segment[] => {
  const sorted = [...input]
    .filter((s) => s.entries.length > 0)
    .sort((a, b) => firstRank(a) - firstRank(b))
  const out: Segment[] = []
  for (const next of sorted) {
    const current = out[out.length - 1]
    if (current === undefined || firstRank(next) > lastRank(current) + 1) {
      out.push({ ...next, entries: [...next.entries] })
      continue
    }
    // Touching or overlapping: one run of ranks now. Boundary tokens follow
    // the side that reaches further; on an exact tie a DEFINED token wins,
    // because an upward page never carries a downward token (and vice versa)
    // — its absence there is ignorance, not "the board ends here".
    const byUser = new Map<string, BoardEntry>()
    for (const e of current.entries) byUser.set(e.userId, e)
    for (const e of next.entries) byUser.set(e.userId, e)
    if (lastRank(next) > lastRank(current)) current.nextCursor = next.nextCursor
    else if (lastRank(next) === lastRank(current)) {
      current.nextCursor = next.nextCursor ?? current.nextCursor
    }
    if (firstRank(next) < firstRank(current)) current.prevCursor = next.prevCursor
    else if (firstRank(next) === firstRank(current)) {
      current.prevCursor = next.prevCursor ?? current.prevCursor
    }
    current.entries = [...byUser.values()].sort((a, b) => a.rank - b.rank)
  }
  return out
}

/**
 * A ranking, held as rank-contiguous SEGMENTS.
 *
 * Scrolling from the top grows one segment downward, exactly as before. A
 * jump to the caller's row can open a SECOND segment — the around=me window —
 * anywhere below; each segment then continues independently in both
 * directions (`?cursor=` down, `?before=` up), and two segments that grow
 * into each other merge. Reads go through the shared query client, so pages
 * revisit the same 30-second cache the per-cursor queries always used.
 */
export function useBoardFeed(bucket: Ref<string>): BoardFeed {
  const segments = ref<Segment[]>([])
  const pending = ref(0)
  const failed = ref<(() => void) | null>(null)
  let nextId = 0
  // Results landing after a bucket switch belong to a board nobody is
  // looking at any more.
  let generation = 0

  const run = (op: () => Promise<void>): void => {
    const at = generation
    pending.value += 1
    op()
      .then(() => {
        if (at === generation) failed.value = null
      })
      .catch((err: unknown) => {
        if (at !== generation) return
        logger.warn('leaderboards: board page failed', err)
        failed.value = () => run(op)
      })
      .finally(() => {
        pending.value -= 1
      })
  }

  const absorb = (page: BoardPage, at: number): void => {
    if (at !== generation || page.bucket !== bucket.value) return
    segments.value = mergeSegments([
      ...segments.value,
      {
        id: nextId++,
        entries: [...page.entries],
        ...(page.prevCursor === undefined ? {} : { prevCursor: page.prevCursor }),
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor })
      }
    ])
  }

  const loadFirst = (): void => {
    const at = generation
    run(async () => {
      const page = await queryClient.fetchQuery(boardPageQueryOptions(bucket.value))
      absorb(page, at)
    })
  }

  watch(
    bucket,
    () => {
      generation += 1
      segments.value = []
      failed.value = null
      loadFirst()
    },
    { immediate: true }
  )

  const last = computed(() => segments.value[segments.value.length - 1])

  /**
   * An empty page is the board saying "nothing further here" — the spawning
   * segment's token is retired, or the affordance would ask forever. (A page
   * WITH rows retires it too, through the merge's boundary rule.)
   */
  const retire = (segmentId: number, side: 'prevCursor' | 'nextCursor', at: number): void => {
    if (at !== generation) return
    const segment = segments.value.find((s) => s.id === segmentId)
    if (segment !== undefined) delete segment[side]
  }

  const loadMore = (): void => {
    const tail = last.value
    const cursor = tail?.nextCursor
    if (tail === undefined || cursor === undefined) return
    const at = generation
    run(async () => {
      const page = await queryClient.fetchQuery(boardPageQueryOptions(bucket.value, cursor))
      if (page.entries.length === 0) retire(tail.id, 'nextCursor', at)
      else absorb(page, at)
    })
  }

  const loadBefore = (segmentId: number): void => {
    const before = segments.value.find((s) => s.id === segmentId)?.prevCursor
    if (before === undefined) return
    const at = generation
    run(async () => {
      const page = await queryClient.fetchQuery(boardPageBeforeQueryOptions(bucket.value, before))
      if (page.entries.length === 0) retire(segmentId, 'prevCursor', at)
      else absorb(page, at)
    })
  }

  const ensureSelf = async (selfUserId: string): Promise<boolean> => {
    const has = (): boolean =>
      segments.value.some((s) => s.entries.some((e) => e.userId === selfUserId))
    if (has()) return true
    const at = generation
    try {
      const window = await queryClient.fetchQuery(boardAroundQueryOptions(bucket.value))
      if (window === null || at !== generation) return false
      absorb(window, at)
      return has()
    } catch (err) {
      // A secondary affordance: the jump quietly does nothing, and why is in
      // the log rather than in a red box over a working board.
      logger.warn('leaderboards: around=me failed', err)
      return false
    }
  }

  return {
    segments: computed(() => segments.value),
    entries: computed(() => segments.value.flatMap((s) => s.entries)),
    isLoading: computed(() => segments.value.length === 0 && pending.value > 0),
    isLoadingMore: computed(() => segments.value.length > 0 && pending.value > 0),
    isError: computed(() => failed.value !== null),
    hasMore: computed(() => last.value?.nextCursor !== undefined || pending.value > 0),
    loadMore,
    loadBefore,
    ensureSelf,
    retry: () => {
      const again = failed.value
      failed.value = null
      if (again !== null) again()
    }
  }
}
