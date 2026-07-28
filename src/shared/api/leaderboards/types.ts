/** Layer 1 — Leaderboard request types. */

/**
 * One page request. `limit` defaults to 50 server-side and is clamped to 100;
 * `cursor` (downward) and `before` (upward) are the opaque base64url tokens a
 * previous page returned, and they are mutually exclusive — each names one
 * position in the ranking.
 */
export interface BoardPageParams {
  readonly bucket: string
  readonly cursor?: string
  readonly before?: string
  readonly limit?: number
}
