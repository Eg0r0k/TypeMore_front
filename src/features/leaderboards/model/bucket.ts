import { isQuoteBucket, type BucketInfo } from '@shared/api'

/**
 * Every board the boards PAGE browses: the language boards.
 *
 * Quote boards are deliberately not in this list. There is one per quote and
 * the corpus is ~15 800 of them, so they cannot be browsed — and a row named
 * after a uuid is not a row anyone can choose between. A quote board is reached
 * from the quote instead (the results screen after a quote run, or a link), and
 * `?bucket=quote:<id>` still resolves: it is unlisted, not unreachable.
 */
export const browsableBuckets = (buckets: readonly BucketInfo[]): BucketInfo[] =>
  buckets.filter((bucket) => !isQuoteBucket(bucket))

/**
 * Which board a visitor lands on when the URL does not say.
 *
 * The busiest bucket is the one worth showing: `entries` is already the
 * ban-filtered visible count (LEADERBOARDS.md — `leaderboard_rows` is the only
 * door), so it needs no adjustment here.
 *
 * Quote boards are skipped for the same reason they are unlisted: landing on
 * one means landing on a board about a text the visitor has not read, with no
 * way to tell why they are there. Passing an all-quote catalogue therefore
 * yields `undefined`, which the page renders as "no boards" — honest, because
 * there is indeed nothing here to browse.
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
  for (const candidate of browsableBuckets(buckets)) {
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
