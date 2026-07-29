/**
 * The standings order — MATCH.md §1 tiers, as one pure function.
 *
 * Lifted out of `session-store.computeStandings` so the RULE can be tested for
 * what it is (a total order over rows) instead of only through a full loopback
 * match, which can stage a finisher and one eliminated seat but not the field of
 * dnf'd seats the tie-breaks are actually about.
 *
 * `computeStandings` still owns everything above this: folding each player's
 * log, deriving `progress`/`wpm`/`score`, and building `countedRankKey`.
 */
import type { StandingRow } from './session-store'

/** The three tiers, best first. Exported for the tests that name them. */
export const TIER = {
  /** Crossed the finish line under their own rules. */
  finished: 0,
  /** Sent `finish`, but their own log proves a freemod rule ended the run. */
  eliminated: 1,
  /** Never sent a real finish: swept, disconnected, or walked out. */
  gone: 2
} as const

export function tierOf(row: StandingRow): number {
  if (row.status !== 'finished') return TIER.gone
  return row.failReason === undefined ? TIER.finished : TIER.eliminated
}

export interface RankOptions {
  /** The frozen room mode: `time` ranks finishers by score, everything else by the clock. */
  readonly mode: string
  /**
   * Counted-mode rank key per finisher — the LOG's completion instant, with the
   * server's receipt time as the fallback (see `computeStandings`).
   */
  readonly countedRankKey: ReadonlyMap<string, number>
}

/**
 * Sort `rows` IN PLACE into finishing order and stamp `rank`.
 *
 * Tier 0 — real finishers. Counted modes (words, quote) rank by who completed
 * the same text first; timed mode by scoreV2, since everyone had the same clock.
 *
 * Tiers 1 and 2 — everyone who did not finish, whichever way they left. Both
 * order by how far into the TEXT they got (canonical progress, not caret
 * position), then by speed among equals.
 *
 * That last part is the fix for a real inversion: dnf used to rank by partial-log
 * WPM, so a seat that typed five words at 120 wpm and then went AFK placed above
 * one that honestly reached 80 % of the text at 60. Speed measured over a
 * fragment of a run is not a standing — distance covered is, and it is already
 * how a freemod knockout is ranked one tier above.
 */
export function rankStandings(rows: StandingRow[], options: RankOptions): StandingRow[] {
  rows.sort((a, b) => {
    const tierA = tierOf(a)
    const tierB = tierOf(b)
    if (tierA !== tierB) return tierA - tierB

    if (tierA === TIER.finished) {
      if (options.mode !== 'time') {
        return (
          (options.countedRankKey.get(a.playerId) ?? Number.POSITIVE_INFINITY) -
          (options.countedRankKey.get(b.playerId) ?? Number.POSITIVE_INFINITY)
        )
      }
      return (b.score ?? 0) - (a.score ?? 0)
    }

    if (a.progress !== b.progress) return b.progress - a.progress
    // Same distance covered: the faster of the two got there first.
    return (b.wpm ?? 0) - (a.wpm ?? 0)
  })
  rows.forEach((row, index) => (row.rank = index + 1))
  return rows
}
