/**
 * The seams of the windowed feed: an around=me window dropped anywhere in the
 * ranking, then keyset pages joined onto it from both directions, must tile
 * the board with NO duplicate and NO missing row — whatever order the loads
 * land in, whatever the page sizes, wherever the caller sits.
 *
 * A simulated server (the same window/continuation arithmetic the Go handler
 * implements, over an N-row board) serves a PROPERTY-style sweep: many seeded
 * scenarios × random operation sequences, with the invariants asserted after
 * every operation and full-board equality at the end.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

import type { BoardEntry } from '@shared/api'

const h = vi.hoisted(() => ({ page: vi.fn(), before: vi.fn(), around: vi.fn() }))

vi.mock('@shared/api', () => ({
  boardPageQueryOptions: (bucket: string, cursor?: string) => ({
    queryKey: ['board', bucket, cursor ?? ''],
    queryFn: () => h.page(bucket, cursor)
  }),
  boardPageBeforeQueryOptions: (bucket: string, before: string) => ({
    queryKey: ['board', bucket, 'before', before],
    queryFn: () => h.before(bucket, before)
  }),
  boardAroundQueryOptions: (bucket: string) => ({
    queryKey: ['board', bucket, 'around'],
    queryFn: () => h.around(bucket)
  })
}))

vi.mock('@/shared/api/query-client', async () => {
  const { QueryClient } = await import('@tanstack/vue-query')
  return {
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
    })
  }
})

import { mergeSegments, useBoardFeed, type BoardFeed } from '@/features/leaderboards'

let BUCKET = 'time:15000:en:seeded'

const entryAt = (rank: number): BoardEntry => ({
  rank,
  userId: `user-${rank}`,
  displayName: `player-${rank}`,
  score: 1_000_000 - rank * 1000,
  wpm: 100,
  raw: 100,
  acc: 1,
  grade: 'S',
  mods: {
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false,
    nospace: false,
    difficulty: 'normal',
    minWpm: 0,
    blind: false,
    fading: false,
    flashlight: false
  },
  runId: `run-${rank}`,
  achievedAt: '2026-07-20T10:15:00.000Z'
})

/**
 * The simulated server: N rows, cursor tokens are the RANK they point at
 * (opaque to the client, which only ever hands them back). The window and the
 * two continuations mirror the Go handler: half above (backfilled at either
 * edge), the caller in the middle, prev/next only where rows continue.
 */
const serve = (boardSize: number, selfRank: number | null, pageSize: number): void => {
  const rows = Array.from({ length: boardSize }, (_, i) => entryAt(i + 1))
  const slice = (from: number, to: number) => rows.slice(Math.max(0, from - 1), to)

  h.page.mockImplementation((_bucket: string, cursor?: string) => {
    const after = cursor === undefined ? 0 : Number(cursor)
    const entries = slice(after + 1, after + pageSize)
    const lastRank = after + entries.length
    return Promise.resolve({
      bucket: BUCKET,
      entries,
      ...(lastRank < boardSize && entries.length > 0 ? { nextCursor: String(lastRank) } : {})
    })
  })

  h.before.mockImplementation((_bucket: string, before: string) => {
    const at = Number(before)
    const first = Math.max(1, at - pageSize)
    const entries = slice(first, at - 1)
    return Promise.resolve({
      bucket: BUCKET,
      entries,
      ...(first > 1 && entries.length > 0 ? { prevCursor: String(first) } : {})
    })
  })

  h.around.mockImplementation(() => {
    if (selfRank === null) return Promise.resolve(null)
    let wantAbove = Math.min(Math.floor((pageSize - 1) / 2), selfRank - 1)
    const wantBelow = Math.min(pageSize - 1 - wantAbove, boardSize - selfRank)
    wantAbove = Math.min(pageSize - 1 - wantBelow, selfRank - 1)
    const first = selfRank - wantAbove
    const last = selfRank + wantBelow
    return Promise.resolve({
      bucket: BUCKET,
      entries: slice(first, last),
      ...(first > 1 ? { prevCursor: String(first) } : {}),
      ...(last < boardSize ? { nextCursor: String(last) } : {})
    })
  })
}

/** Deterministic PRNG so a failing scenario is re-runnable by its seed. */
const rng = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const settle = async (): Promise<void> => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

let scope: EffectScope

const makeFeed = (): BoardFeed => {
  scope = effectScope()
  const feed = scope.run(() => useBoardFeed(ref(BUCKET)))
  if (feed === undefined) throw new Error('scope.run returned nothing')
  return feed
}

/** The invariants every intermediate state owes the reader. */
const assertSane = (feed: BoardFeed, where: string): void => {
  const flat = feed.entries.value
  const users = new Set(flat.map((e) => e.userId))
  expect(users.size, `${where}: a player rendered twice`).toBe(flat.length)
  for (let i = 1; i < flat.length; i++) {
    expect(flat[i].rank, `${where}: ranks out of order`).toBeGreaterThan(flat[i - 1].rank)
  }
  // Segments are genuinely disjoint: consecutive ones are separated by a real
  // gap, or they would have merged.
  const segments = feed.segments.value
  for (let i = 1; i < segments.length; i++) {
    const above = segments[i - 1].entries.at(-1)?.rank ?? 0
    const below = segments[i].entries[0]?.rank ?? 0
    expect(below - above, `${where}: touching segments left unmerged`).toBeGreaterThan(1)
  }
}

beforeEach(() => {
  h.page.mockReset()
  h.before.mockReset()
  h.around.mockReset()
})

describe('feed seams', () => {
  it(
    'tiles the board across window and keyset joins, under a random-op sweep',
    { timeout: 30_000 },
    async () => {
      // 24 seeded scenarios: board size, self position and page size all vary,
      // including the degenerate edges (self at rank 1, self last, one-row
      // board, window bigger than the board).
      for (let seed = 1; seed <= 24; seed++) {
        const random = rng(seed * 2654435761)
        const boardSize = 1 + Math.floor(random() * 60)
        const selfRank = 1 + Math.floor(random() * boardSize)
        const pageSize = 1 + Math.floor(random() * 7)
        // A bucket per scenario keeps one scenario's in-flight fetches out of
        // the next one's cache keys.
        BUCKET = `time:15000:seed-${seed}:seeded`
        serve(boardSize, selfRank, pageSize)

        const feed = makeFeed()
        await settle()
        const label = `seed ${seed} (n=${boardSize} self=${selfRank} page=${pageSize})`
        assertSane(feed, `${label} after first page`)

        // A jump somewhere into the board, then a random walk of loads.
        await feed.ensureSelf(`user-${selfRank}`)
        await settle()
        assertSane(feed, `${label} after jump`)
        expect(
          feed.entries.value.some((e) => e.userId === `user-${selfRank}`),
          `${label}: the jump must land the caller's row`
        ).toBe(true)

        for (let op = 0; op < 12; op++) {
          const segments = feed.segments.value
          const dice = random()
          if (dice < 0.5 && feed.hasMore.value) {
            feed.loadMore()
          } else {
            const withPrev = segments.filter((s) => s.prevCursor !== undefined)
            const target = withPrev[Math.floor(random() * withPrev.length)]
            if (target !== undefined) feed.loadBefore(target.id)
          }
          await settle()
          assertSane(feed, `${label} op ${op}`)
        }

        // Drain everything that is still loadable, then demand the whole board.
        for (let guard = 0; guard < 200; guard++) {
          const gap = feed.segments.value.find((s) => s.prevCursor !== undefined)
          if (gap !== undefined) {
            feed.loadBefore(gap.id)
          } else if (feed.hasMore.value) {
            feed.loadMore()
          } else {
            break
          }
          await settle()
          assertSane(feed, `${label} drain ${guard}`)
        }

        expect(
          feed.entries.value.map((e) => e.rank),
          `${label}: the fully-drained feed IS the board`
        ).toEqual(Array.from({ length: boardSize }, (_, i) => i + 1))

        scope.stop()
      }
    }
  )

  it('answers false for a caller the window cannot centre on (204)', async () => {
    serve(10, null, 5)
    const feed = makeFeed()
    await settle()

    expect(await feed.ensureSelf('user-99')).toBe(false)
    assertSane(feed, 'after a null window')

    scope.stop()
  })

  it('merge keeps the wider side’s continuation and prefers knowledge on a tie', () => {
    const seg = (
      id: number,
      ranks: number[],
      cursors: { prevCursor?: string; nextCursor?: string } = {}
    ) => ({ id, entries: ranks.map(entryAt), ...cursors })

    // An upward page ending exactly where the top segment ends must not
    // erase the top segment's downward token: absence on an upward page is
    // ignorance, not "the board ends here".
    const merged = mergeSegments([
      seg(0, [1, 2, 3], { nextCursor: '3' }),
      seg(1, [2, 3], { prevCursor: '2' })
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].nextCursor).toBe('3')

    // Disjoint stays disjoint.
    const apart = mergeSegments([seg(0, [1, 2]), seg(1, [5, 6], { prevCursor: '5' })])
    expect(apart).toHaveLength(2)
  })
})
