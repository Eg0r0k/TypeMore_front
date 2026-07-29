/**
 * Benchmarks for the log-derived hot paths the results/replay screens lean on.
 *
 * Every metric here is a PURE function of the event log, so the costs scale
 * with log length, not UI complexity. Sizes: a 60s run (~2k events), a 10-min
 * run (~14k), and the documented worst case (~40k, an hour-long log).
 *
 * Run with: npx vitest bench --run src/__tests__/perf/
 */
import { bench, describe } from 'vitest'

import { GhostDriver } from '@/entities/match/model/ghost-driver'
import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  afkOf,
  analyzeLog,
  asMs,
  commitEvent,
  computeMetrics,
  insertEvent,
  wordHistory,
  wpmOverTime
} from '@shared/core'
import { replayResults } from '@/features/replay-view'
import type { ReplayData } from '@entities/game'

const coreCfg: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

/**
 * A typed run: every word is 5 chars + commit (6 events per word), one typo
 * per ten characters, ~180ms between keystrokes-worth of timeline spread.
 */
function buildRun(wordCount: number): { ctx: CoreContext; events: GameEvent[] } {
  const words = Array.from({ length: wordCount }, () => 'abcde')
  const events: GameEvent[] = []
  let seq = 0
  let t = 0
  let chars = 0
  for (let w = 0; w < wordCount; w++) {
    for (const char of 'abcde') {
      chars += 1
      t += 60
      events.push(insertEvent(++seq, t, chars % 10 === 0 ? 'x' : char))
    }
    t += 60
    events.push(commitEvent(++seq, t))
  }
  return { ctx: { config: coreCfg, words }, events }
}

const SIZES = [
  { label: '2k events (60s run)', words: 340 },
  { label: '14k events (10min run)', words: 2400 },
  { label: '40k events (hour run)', words: 6700 }
] as const

const runs = SIZES.map((size) => ({ ...size, ...buildRun(size.words) }))

const replayOf = (ctx: CoreContext, events: GameEvent[]): ReplayData => ({
  config: ctx.config,
  words: ctx.words,
  log: events,
  generation: {
    mode: 'words',
    length: ctx.words.length,
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false
  },
  declaration: { blind: false, fading: false, flashlight: false },
  score: {
    version: 2,
    total: 0,
    base: 0,
    comboPeak: 0,
    accMultiplier: 1,
    timeBonus: null
  },
  grade: 'A'
})

for (const run of runs) {
  const endMs = asMs(run.events[run.events.length - 1].t)

  describe(`single fold — ${run.label}`, () => {
    bench('analyzeLog (baseline)', () => {
      analyzeLog(run.ctx, run.events)
    })
    bench('wordHistory (one extra fold)', () => {
      wordHistory(run.ctx, run.events)
    })
    bench('wpmOverTime (fold + bucketing)', () => {
      wpmOverTime(run.ctx, run.events, endMs)
    })
  })

  describe(`results-screen composites — ${run.label}`, () => {
    bench('replayResults (leaderboard page, all four derivations)', () => {
      replayResults(replayOf(run.ctx, run.events))
    })
    bench('solo results (metrics + timeline + afk + history, separate folds)', () => {
      computeMetrics(run.ctx, run.events, endMs)
      wpmOverTime(run.ctx, run.events, endMs)
      afkOf(run.ctx, run.events, endMs)
      wordHistory(run.ctx, run.events)
    })
  })
}

// Backward seek: each backward scrub step is reset() + advance(t) — a re-fold
// of the prefix through the driver (reducer + reactive refs), fired per
// pointermove. The per-step cost bounds how fast the bar can be dragged left.
for (const run of runs) {
  describe(`replay backward-seek step — ${run.label}`, () => {
    const driver = new GhostDriver({ config: run.ctx.config, words: run.ctx.words }, { delayMs: 0 })
    driver.append(run.events)
    const midT = run.events[Math.floor(run.events.length / 2)].t

    bench('reset + advance(mid)', () => {
      driver.reset()
      driver.advance(midT)
    })
    bench('reset + advance(full)', () => {
      driver.reset()
      driver.advance(run.events[run.events.length - 1].t)
    })
  })
}
