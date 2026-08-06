/**
 * "Top X%" for the pinned self row: rank over the bucket's visible entry
 * count, rounded UP — a claim of "Top 1%" must never flatter. The last place
 * is exactly Top 100%.
 *
 * Whole percents down to 1%, then finer steps: a whole floor would tell rank
 * 1 of 10 000 "Top 1%" when the honest figure is Top 0.01%. One decimal from
 * 0.1%, two below that — still always rounded up, so the finest claim
 * understates the achievement rather than inflating it (and 0.01% is the
 * floor: never Top 0%, zero of something is not a place on it).
 *
 * `entries` comes from the catalogue and `rank` from `/me`; the two are read
 * at different instants, so a rank beyond the count (the board grew colder
 * since the catalogue answered) clamps to 100 rather than claiming 104%.
 * No honest percentile exists without both halves — that is `null`, and the
 * row simply shows the rank alone.
 */
export const topPercent = (rank: number, entries: number | undefined): number | null => {
  if (entries === undefined || entries <= 0 || rank < 1) return null
  if (rank >= entries) return 100
  // Integer multiply BEFORE each divide: (7 / 50) * 100 is 14.000000000000002
  // in floats, and ceil would round an exact 14% up to 15.
  if (rank * 100 >= entries) return Math.ceil((rank * 100) / entries)
  if (rank * 1000 >= entries) return Math.ceil((rank * 1000) / entries) / 10
  return Math.ceil((rank * 10000) / entries) / 100
}
