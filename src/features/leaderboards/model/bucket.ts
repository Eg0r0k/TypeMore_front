import type { BucketInfo } from '@shared/api'

/**
 * Which board a visitor lands on when the URL does not say.
 *
 * The busiest bucket is the one worth showing: `entries` is already the
 * ban-filtered visible count (LEADERBOARDS.md — `leaderboard_rows` is the only
 * door), so it needs no adjustment here.
 *
 * TIE-BREAK: equal counts break by bucket key ASCENDING. `entries` alone is not
 * a total order, and the catalogue's array order is the server's — two
 * identical responses may list equal-count buckets in either order, and
 * `Array.prototype.sort` is only stable with respect to the order it was
 * handed. Without the key tie-break, two reloads of the same catalogue can land
 * on different boards, which is the kind of bug that never reproduces in the
 * session that reports it.
 *
 * Returns `undefined` only for an empty catalogue — a real 200 answer meaning
 * no bucket anywhere holds a visible entry, not a failure.
 */
export const mostPopulatedBucket = (buckets: readonly BucketInfo[]): string | undefined => {
  let best: BucketInfo | undefined
  for (const candidate of buckets) {
    if (
      best === undefined ||
      candidate.entries > best.entries ||
      (candidate.entries === best.entries && candidate.bucket < best.bucket)
    ) {
      best = candidate
    }
  }
  return best?.bucket
}
