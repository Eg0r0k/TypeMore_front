import { queryOptions } from '@tanstack/vue-query'
import { getRun, getRunReplay, getRunReplayLog, listRuns } from './endpoints'
import { runKeys } from './keys'

/** Layer 2 — Runs queryOptions factories. */

export const runsQueryOptions = (cursor?: string, limit?: number) =>
  queryOptions({
    queryKey: runKeys.list(cursor, limit),
    queryFn: () => listRuns({ cursor, limit })
  })

export const runQueryOptions = (id: string) =>
  queryOptions({
    queryKey: runKeys.detail(id),
    queryFn: () => getRun(id)
  })

/**
 * The public replay pair, as two INDEPENDENT queries.
 *
 * Keeping them separate is the point: the metadata can succeed while the log
 * fetch fails, and that is a distinct failure the view must be able to retry on
 * its own without re-asking whether the run exists.
 *
 * Both are immutable once judged — the log bytes are written at ingestion and
 * served `immutable`, and the metadata changes only if a verdict is revised —
 * so neither is refetched within a session.
 */
const JUDGED_RUN_IS_IMMUTABLE = { staleTime: Infinity, gcTime: Infinity } as const

export const runReplayQueryOptions = (id: string) =>
  queryOptions({
    queryKey: runKeys.replay(id),
    queryFn: () => getRunReplay(id),
    ...JUDGED_RUN_IS_IMMUTABLE
  })

export const runReplayLogQueryOptions = (id: string) =>
  queryOptions({
    queryKey: runKeys.replayLog(id),
    queryFn: () => getRunReplayLog(id),
    ...JUDGED_RUN_IS_IMMUTABLE
  })
