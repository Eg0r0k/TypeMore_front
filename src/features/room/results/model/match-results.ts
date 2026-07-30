/**
 * What the room's results screen renders, derived from the match session.
 *
 * Two shapes come out of the same source. Once `match_end` has landed the
 * session store publishes folded `standings`, and the table is a final one.
 * Before that — an eliminated seat watching the match run on without it — there
 * are no standings at all, so the table is built from the live `peers` view and
 * keeps updating while the others race.
 */
import { computed } from 'vue'

import type { ActiveMod, FailReason, Metrics, ScoreResult, TimelinePoint } from '@typemore/core'
import type { Freemods } from '@shared/match-transport'
import { useGameStore } from '@/entities/game'
import { MATCH_SESSION_STORE_ID, useMatchSessionStore } from '@/entities/match'
import type { OutcomeReason } from '@/entities/match'
import type { StandingRow } from '@/entities/lobby'
import type { ResultSummary } from '@/features/test/results'

/** Everything the solo results view needs about the local seat's own run. */
export interface MatchSelfRun {
  readonly metrics: Metrics
  readonly timeline: readonly TimelinePoint[]
  readonly score: ScoreResult | null
  readonly activeMods: readonly ActiveMod[]
  readonly failReason: FailReason | null
  readonly afkMs: number
  readonly summary: ResultSummary
}

/** Defensive only: a seat that is not (or no longer) in the room roster. */
const FALLBACK_FREEMODS: Freemods = { difficulty: 'normal', minWpm: 0, nospace: false }

export function useMatchResults() {
  const session = useMatchSessionStore()

  const freemodsOf = (playerId: string): Freemods =>
    session.room?.players.find((seat) => seat.playerId === playerId)?.freemods ?? FALLBACK_FREEMODS

  const mode = computed(() => session.room?.settings.mode ?? 'time')

  /** The result screen is up for a seat that is out, or for the whole match. */
  const showing = computed(() => session.phase === 'results' || session.phase === 'eliminated')

  /** Live means the match has not ended: rows keep moving and ranks are provisional. */
  const live = computed(() => session.phase === 'eliminated')

  /**
   * The room's settings as the solo screen's "test type" cell reads them. The
   * shape half is the room's (mode, length, text mods, language); the difficulty
   * and nospace halves are this seat's own freemods, which is exactly what the
   * run was played under.
   */
  const summary = computed<ResultSummary>(() => {
    const settings = session.room?.settings
    const freemods = session.selfId === null ? undefined : freemodsOf(session.selfId)
    return {
      mode: settings?.mode ?? 'time',
      language: settings?.lang ?? '',
      difficulty: freemods?.difficulty ?? 'normal',
      amount:
        settings?.mode === 'time'
          ? Math.round((settings.durationMs ?? 0) / 1000)
          : (settings?.wordCount ?? 0),
      punctuation: settings?.textMods.punctuation ?? false,
      numbers: settings?.textMods.numbers ?? false,
      randomCase: settings?.textMods.randomCase ?? false,
      nospace: freemods?.nospace ?? false
    }
  })

  /**
   * The local seat's own run, in full.
   *
   * The session store keeps its game store private and publishes only wpm / acc /
   * score (`selfOutcome`) — not the timeline, the char breakdown or the mod
   * breakdown the solo view draws — so the run is read from the game-store
   * registry under the session's own id. Resolved INSIDE the computed and only
   * while a result is on screen, so a lobby never instantiates a store for a run
   * that has not happened.
   */
  const selfRun = computed<MatchSelfRun | null>(() => {
    if (!showing.value) return null
    const local = useGameStore(MATCH_SESSION_STORE_ID)
    // A reload forfeit never set a core up — the log died with the page. A screen
    // of hard zeros would read as a catastrophic run rather than as "no data".
    if (local.snapshot.phase === 'idle') return null
    return {
      metrics: local.metrics,
      timeline: local.timeline,
      score: local.scoreResult,
      activeMods: local.activeMods,
      failReason: local.snapshot.failReason,
      afkMs: local.afk.afkMs,
      summary: summary.value
    }
  })

  /**
   * The table while the match is still on. Every opponent number comes off the
   * live `peers` view, so the row of someone still racing keeps climbing; the
   * local row is frozen, because this seat's run is already over.
   */
  const liveRows = computed<StandingRow[]>(() => {
    const run = selfRun.value
    const outcome = session.selfOutcome
    const rows: StandingRow[] = session.peers.map((peer) => ({
      rank: 0,
      playerId: peer.playerId,
      nick: peer.nick,
      isSelf: false,
      status: peer.status,
      wpm: peer.metrics.wpm,
      acc: peer.metrics.acc,
      failReason: peer.failReason,
      progress: peer.metrics.progress,
      freemods: freemodsOf(peer.playerId)
    }))
    const selfId = session.selfId
    if (selfId !== null) {
      // Both forfeits — the reload and the idle kick — are a dnf server-side;
      // a freemod rule is an elimination with a provable failReason.
      const forfeited = outcome?.reason === 'reload' || outcome?.reason === 'idle'
      rows.push({
        rank: 0,
        playerId: selfId,
        nick: session.room?.players.find((seat) => seat.playerId === selfId)?.nick ?? '',
        isSelf: true,
        status: forfeited ? 'dnf' : 'eliminated',
        wpm: run?.metrics.wpm,
        raw: run?.metrics.raw,
        acc: run?.metrics.accuracy,
        chars: run?.metrics.chars,
        failReason:
          outcome !== null && outcome.reason !== 'reload' && outcome.reason !== 'idle'
            ? outcome.reason
            : null,
        progress: outcome?.progress ?? 0,
        freemods: freemodsOf(selfId)
      })
    }
    // Provisional order: how far into the TEXT each seat has got. Nothing finer
    // exists yet — a finish time or a score is only decided at `match_end`, and
    // the server is the one that decides it.
    rows.sort((a, b) => b.progress - a.progress)
    rows.forEach((row, index) => (row.rank = index + 1))
    return rows
  })

  const rows = computed<StandingRow[]>(() => {
    const final = session.standings
    if (final === null) return liveRows.value
    // The store folds a full `Metrics` per seat but publishes only wpm and acc,
    // so raw and the char breakdown are blank for opponents. Ours is right here.
    const run = selfRun.value
    if (run === null) return final
    return final.map((row) =>
      row.isSelf ? { ...row, raw: run.metrics.raw, chars: run.metrics.chars } : row
    )
  })

  /** Non-terminal seats — a graced disconnect is still racing server-side. */
  const racingCount = computed(
    () =>
      session.peers.filter((peer) => peer.status === 'racing' || peer.status === 'disconnected')
        .length
  )

  /** Why this seat is out; the live screen says it in one line. */
  const outcomeReason = computed<OutcomeReason | null>(() => session.selfOutcome?.reason ?? null)

  return { showing, live, mode, rows, selfRun, racingCount, outcomeReason }
}
