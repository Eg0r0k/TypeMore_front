/** Layer 1 — Leaderboard request types. */

/**
 * One page request. `limit` defaults to 50 server-side and is clamped to 100;
 * `cursor` is the opaque base64url token the previous page returned.
 */
export interface BoardPageParams {
  readonly bucket: string
  readonly cursor?: string
  readonly limit?: number
}
