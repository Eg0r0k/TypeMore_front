/**
 * The standings order (MATCH.md §1 tiers) as a total order over rows.
 *
 * The loopback match tests can stage one finisher and one eliminated seat; the
 * tie-breaks that decide a results table are about the FIELD below the finish
 * line — several seats that never finished, ranked against each other. That is
 * what this file covers.
 *
 * The rule that used to be wrong: a dnf'd seat ranked by partial-log WPM, so
 * five words at 120 wpm followed by an exit beat an honest 80 % of the text at
 * 60. Both eliminated tiers now rank by distance covered, and the first test
 * below is exactly that scenario.
 */
import { describe, expect, it } from 'vitest'

import { type StandingRow, TIER, rankStandings, tierOf } from '@entities/match'

const FREEMODS = { difficulty: 'normal', minWpm: 0, nospace: false } as const

const row = (over: Partial<StandingRow> & { playerId: string }): StandingRow => ({
  rank: 0,
  nick: over.playerId,
  isSelf: false,
  status: 'finished',
  progress: 0,
  freemods: { ...FREEMODS },
  ...over
})

const order = (rows: StandingRow[], mode = 'words', counted: [string, number][] = []): string[] =>
  rankStandings(rows, { mode, countedRankKey: new Map(counted) }).map((r) => r.playerId)

describe('standings order: who did not finish ranks by distance, not speed', () => {
  it('the AFK sprinter loses to the honest slow player', () => {
    // The audit's exact case: a seat that typed five words at 120 wpm and left,
    // against one that reached 80 % of the text at 60 wpm. Both dnf.
    const sprinter = row({ playerId: 'sprinter', status: 'dnf', progress: 0.11, wpm: 120 })
    const grinder = row({ playerId: 'grinder', status: 'dnf', progress: 0.8, wpm: 60 })

    expect(order([sprinter, grinder])).toEqual(['grinder', 'sprinter'])
    // …and the input order does not decide it.
    expect(order([grinder, sprinter])).toEqual(['grinder', 'sprinter'])
    expect(grinder.rank).toBe(1)
    expect(sprinter.rank).toBe(2)
  })

  it('ranks a dnf field exactly like a freemod-knockout field', () => {
    const progresses = [0.2, 0.95, 0.5, 0.05, 0.71]
    // Speed deliberately runs OPPOSITE to progress, so a wpm-ordered table would
    // come out exactly reversed and the assertion could not pass by accident.
    const build = (kind: 'dnf' | 'eliminated'): StandingRow[] =>
      progresses.map((progress, i) =>
        row({
          playerId: `p${i}`,
          status: kind === 'dnf' ? 'dnf' : 'finished',
          failReason: kind === 'eliminated' ? 'master' : undefined,
          progress,
          wpm: 200 - progress * 100
        })
      )

    const byProgress = ['p1', 'p4', 'p2', 'p0', 'p3']
    expect(order(build('dnf'))).toEqual(byProgress)
    expect(order(build('eliminated'))).toEqual(byProgress)
  })

  it('breaks a progress tie by speed', () => {
    const slow = row({ playerId: 'slow', status: 'dnf', progress: 0.4, wpm: 30 })
    const fast = row({ playerId: 'fast', status: 'dnf', progress: 0.4, wpm: 90 })
    expect(order([slow, fast])).toEqual(['fast', 'slow'])
  })

  it('a missing wpm sorts last among equals rather than throwing the order out', () => {
    const known = row({ playerId: 'known', status: 'dnf', progress: 0.4, wpm: 1 })
    const unknown = row({ playerId: 'unknown', status: 'dnf', progress: 0.4 })
    expect(order([unknown, known])).toEqual(['known', 'unknown'])
  })
})

describe('standings order: the tiers still hold above it', () => {
  it('finisher, then freemod knockout, then dnf/left — whatever their numbers', () => {
    // Every loser here is FASTER and FURTHER than the winner: only the tier
    // decides, and `left` sits in the same tier as `dnf`.
    const finisher = row({ playerId: 'finisher', progress: 0.3, wpm: 40 })
    const knockedOut = row({ playerId: 'knocked', failReason: 'minSpeed', progress: 1, wpm: 200 })
    const swept = row({ playerId: 'swept', status: 'dnf', progress: 1, wpm: 300 })
    // Faster still, but shorter: `left` shares the bottom tier with `dnf` and is
    // ranked by the same rule, so distance beats speed here too.
    const walkedOut = row({ playerId: 'left', status: 'left', progress: 0.9, wpm: 400 })

    expect(order([swept, walkedOut, knockedOut, finisher], 'words', [['finisher', 5000]])).toEqual([
      'finisher',
      'knocked',
      'swept',
      'left'
    ])
    expect(tierOf(finisher)).toBe(TIER.finished)
    expect(tierOf(knockedOut)).toBe(TIER.eliminated)
    expect(tierOf(swept)).toBe(TIER.gone)
    expect(tierOf(walkedOut)).toBe(TIER.gone)
  })

  it('counted modes rank finishers by the log clock; timed modes by score', () => {
    const early = row({ playerId: 'early', finishTimeMs: 4000, score: 10 })
    const late = row({ playerId: 'late', finishTimeMs: 9000, score: 900 })
    const counted: [string, number][] = [
      ['early', 4000],
      ['late', 9000]
    ]
    expect(order([late, early], 'words', counted)).toEqual(['early', 'late'])
    expect(order([early, late], 'quote', counted)).toEqual(['early', 'late'])
    // Same two rows, timed room: the clock is shared, so the score decides.
    expect(order([early, late], 'time', counted)).toEqual(['late', 'early'])
  })

  it('a finisher with no rank key falls behind the ones that have it', () => {
    const proven = row({ playerId: 'proven' })
    const truncated = row({ playerId: 'truncated' })
    expect(order([truncated, proven], 'words', [['proven', 7000]])).toEqual(['proven', 'truncated'])
  })
})
