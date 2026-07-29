/**
 * `replayResults` derives four things from ONE shared `analyzeLog` pass (the
 * standalone wrappers each fold the whole log — 4× the cost on a long log,
 * see core-hotspots.bench.ts). The optimization is only legal while the
 * shared-pass results stay IDENTICAL to the wrappers'; this pins that.
 */
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  afkOf,
  asMs,
  commitEvent,
  computeMetrics,
  insertEvent,
  wordHistory,
  wpmOverTime
} from '@shared/core'
import { replayResults } from '@/features/replay-view'
import type { ReplayData } from '@entities/game'

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

/** A three-word run with a typo, an idle gap (AFK bucket) and an uncommitted tail. */
const events: GameEvent[] = [
  insertEvent(1, 0, 'a'),
  insertEvent(2, 200, 'b'),
  commitEvent(3, 300),
  insertEvent(4, 400, 'x'),
  insertEvent(5, 650, 'd'),
  commitEvent(6, 700),
  // >1s of silence before the last word: one AFK bucket inside the window.
  insertEvent(7, 2500, 'e')
]

const WORDS = ['ab', 'cd', 'ef']

const replayOf = (config: CoreConfig): ReplayData => ({
  config,
  words: WORDS,
  log: events,
  generation: {
    mode: config.mode === 'time' ? 'time' : 'words',
    length: WORDS.length,
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false
  },
  declaration: { blind: false, fading: false, flashlight: false },
  score: { version: 2, total: 0, base: 0, comboPeak: 0, accMultiplier: 1, timeBonus: null },
  grade: 'A'
})

describe('replayResults — the shared fold matches the standalone derivations', () => {
  it.each([
    ['words mode (measures to the last event)', coreCfg(), asMs(2500)],
    [
      'time mode (measures to the deadline)',
      coreCfg({ mode: 'time', durationMs: 5000 }),
      asMs(5000)
    ]
  ])('%s', (_label, config, endMs) => {
    const ctx: CoreContext = { config, words: WORDS }
    const results = replayResults(replayOf(config))

    expect(results.metrics).toEqual(computeMetrics(ctx, events, endMs))
    expect(results.timeline).toEqual(wpmOverTime(ctx, events, endMs))
    expect(results.afk).toEqual(afkOf(ctx, events, endMs))
    expect(results.history).toEqual(wordHistory(ctx, events))
  })
})
