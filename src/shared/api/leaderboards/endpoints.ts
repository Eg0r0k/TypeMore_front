import * as v from 'valibot'
import { ApiError, http, normalizeError, request } from '../transport'
import {
  BoardMeSchema,
  BoardPageSchema,
  BucketCatalogueSchema,
  type BoardMe,
  type BoardPage,
  type BucketCatalogue
} from './schemas'
import type { BoardPageParams } from './types'

/**
 * Layer 1 — Typed leaderboard endpoints mirroring the backend's
 * `docs/LEADERBOARDS.md`. The whole subtree is public except `/{bucket}/me`,
 * which needs a session and says so itself (401) rather than being hidden
 * behind a guard the other two must not have.
 */

/** `GET /leaderboards` — buckets holding at least one visible entry, with counts. */
export const listBuckets = (): Promise<BucketCatalogue> =>
  request('/leaderboards', BucketCatalogueSchema)

/**
 * `GET /leaderboards/{bucket}` — one page of a ranking.
 *
 * The bucket key contains `:` separators, which are legal in a path segment but
 * must not be re-encoded into `%3A` by a naive join — the server matches on the
 * decoded key. `encodeURIComponent` leaves `:` alone only in some engines, so
 * the colons are restored explicitly rather than left to chance.
 */
export const getBoardPage = (params: BoardPageParams): Promise<BoardPage> =>
  request(`/leaderboards/${encodeBucket(params.bucket)}`, BoardPageSchema, {
    query: { cursor: params.cursor, limit: params.limit }
  })

/**
 * `GET /leaderboards/{bucket}/me` — the caller's own slot, or `null`.
 *
 * `204` is a real answer here, not an absence of one: it means "you hold no
 * visible slot on this board", which is also what a banned caller is told. A
 * body-parsing `request()` cannot express that, so this one reads the status
 * itself and collapses `204` to `null`.
 */
export const getBoardMe = async (bucket: string): Promise<BoardMe | null> => {
  let response: { status: number; _data?: unknown }
  try {
    response = await http.raw(`/leaderboards/${encodeBucket(bucket)}/me`)
  } catch (err) {
    throw normalizeError(err)
  }

  if (response.status === 204) return null

  const parsed = v.safeParse(BoardMeSchema, response._data)
  if (!parsed.success) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      message: 'Response body failed schema validation'
    })
  }
  return parsed.output
}

const encodeBucket = (bucket: string): string => encodeURIComponent(bucket).replaceAll('%3A', ':')
