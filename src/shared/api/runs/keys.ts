import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Runs cache keys. The cursor participates in the list key so each
 * page caches independently; `all` is the invalidation handle after a submit.
 *
 * The public replay pair is keyed SEPARATELY from the detail entry: different
 * route, different audience, different lifetime (a judged run's log is
 * immutable) — and the log must be refetchable on its own when only it failed.
 */
export const runKeys = {
  all: [...API_SCOPE, 'runs'] as const,
  /**
   * The page SIZE keys too: the header's sparkline asks for a longer page than
   * the table's, and two different pages sharing one key would serve whichever
   * landed first.
   */
  list: (cursor?: string, limit?: number) =>
    [...runKeys.all, 'list', cursor ?? null, limit ?? null] as const,
  detail: (id: string) => [...runKeys.all, 'detail', id] as const,
  replay: (id: string) => [...runKeys.all, 'replay', id] as const,
  replayLog: (id: string) => [...runKeys.all, 'replay', id, 'log'] as const
} as const
