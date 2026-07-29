/**
 * Results of a reconstructed run — the numbers the solo results screen shows,
 * recomputed from the run's own log. The companion of `replay-from-api.ts`:
 * that file turns the wire pair into a playable `ReplayData`, this one turns
 * the same `ReplayData` into the results-screen inputs, so the `/replay/:runId`
 * page opens on the run's RESULTS (grade, score, chart, stats, input history)
 * and playback is one action away instead of the landing state.
 *
 * `meta.serverMetrics` is deliberately not read: like the replay player, the
 * page renders its own numbers from the log. The server's judgement (score,
 * grade) travels on `ReplayData` already.
 *
 * The end instant mirrors `validateLog`'s: a timed run measures to its
 * DEADLINE (start anchor + configured duration — the log's last event lands
 * before it when the player idled out the tail), everything else to the log's
 * own end, with `finishedAt` — resolved inside the metric functions — winning
 * whenever the fold pinned one.
 */
import {
  type AfkStats,
  type Metrics,
  type Ms,
  type TimelinePoint,
  type WordHistoryEntry,
  afkBetween,
  analyzeLog,
  asMs,
  isTelemetryEvent,
  metricsFrom,
  sortEvents,
  timelineFrom,
  wordHistoryFrom
} from '@shared/core'
import type { CoreContext } from '@shared/core'
import type { ReplayData } from '@entities/game'

export interface ReplayResults {
  readonly metrics: Metrics
  readonly timeline: TimelinePoint[]
  readonly afk: AfkStats
  readonly history: WordHistoryEntry[]
}

export function replayResults(replay: ReplayData): ReplayResults {
  const ctx: CoreContext = { config: replay.config, words: replay.words }
  const events = sortEvents(replay.log)

  // Same anchor as validateLog's two-clock check: a go-anchored (match) log
  // starts at t=0, a solo log at its first STATE event — a v2 log's opening
  // key-down would move the deadline otherwise.
  const stateEvents = events.filter((event) => !isTelemetryEvent(event))
  const startT = replay.config.startPolicy === 'go' ? asMs(0) : (stateEvents[0]?.t ?? asMs(0))
  const lastT = events[events.length - 1]?.t ?? startT
  const endMs: Ms =
    replay.config.mode === 'time' ? asMs(startT + replay.config.durationMs) : asMs(lastT)

  // ONE fold, four derivations. Each convenience wrapper (computeMetrics,
  // wpmOverTime, afkOf, wordHistory) folds the whole log itself; on an
  // hour-long log that is ~4× the cost of the shared pass below (bench:
  // core-hotspots.bench.ts). Every `…From` resolves the run's end the same way
  // the wrapper would: `finalState.finishedAt ?? endMs`.
  const analysis = analyzeLog(ctx, events)
  const finalState = analysis.finalState

  return {
    metrics: metricsFrom(ctx, analysis, endMs),
    timeline: timelineFrom(ctx, analysis, endMs),
    afk: afkBetween(events, finalState.startedAt, finalState.finishedAt ?? endMs),
    history: wordHistoryFrom(ctx, analysis)
  }
}
