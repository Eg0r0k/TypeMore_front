/**
 * "Top X%" for the pinned self row: rank over the bucket's visible entry
 * count, rounded UP — a claim of "Top 1%" must never flatter. Rank 1 of any
 * board is Top 1% (never Top 0%: zero of something is not a place on it), and
 * the last place is exactly Top 100%.
 *
 * `entries` comes from the catalogue and `rank` from `/me`; the two are read
 * at different instants, so a rank beyond the count (the board grew colder
 * since the catalogue answered) clamps to 100 rather than claiming 104%.
 * No honest percentile exists without both halves — that is `null`, and the
 * row simply shows the rank alone.
 */
export const topPercent = (rank: number, entries: number | undefined): number | null => {
  if (entries === undefined || entries <= 0 || rank < 1) return null
  // Integer multiply BEFORE the divide: (7 / 50) * 100 is 14.000000000000002
  // in floats, and ceil would round an exact 14% up to 15.
  return Math.min(100, Math.max(1, Math.ceil((rank * 100) / entries)))
}
