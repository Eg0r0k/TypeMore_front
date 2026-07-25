// @vitest-environment node
//
// MinSpeed mod (SCORING_CONCEPT §2, CoreConfig.minWpm): the net-WPM floor. The
// fail instant is a pure function of the log — `settle` (live tick) and
// `foldLog`/`validateLog` (batch) derive the identical instant. Grace window,
// exact crossing, and post-fail rejection are covered here.
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  DEFAULT_MAX_EXTRA_CHARS,
  EVENT_LOG_VERSION,
  GameCore,
  MINSPEED_GRACE_MS,
  asMs,
  commitEvent,
  dictVersion,
  foldLog,
  generateWords,
  insertEvent,
  makeSeedContext,
  minSpeedFailInstant,
  netCharsOf,
  settle,
  validateLog
} from '@shared/core'

// Uniform 5-char words so net-char arithmetic is exact regardless of generation order.
const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: ['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee', 'fffff', 'ggggg', 'hhhhh']
}
const WORDS = dict.words

const core = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 8,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

/** Type the first `count` words of `words` correctly — one keystroke / 50ms, commit each. */
function typeWords(words: readonly string[], count: number): { log: GameEvent[]; lastT: number } {
  const log: GameEvent[] = []
  let seq = 0
  let t = 0
  for (let w = 0; w < count; w++) {
    for (const ch of words[w]) {
      log.push(insertEvent(++seq, t, ch))
      t += 50
    }
    log.push(commitEvent(++seq, t))
    t += 50
  }
  return { log, lastT: t - 50 }
}

describe('minSpeedFailInstant — pure fail instant', () => {
  const ctx: CoreContext = { config: core({ minWpm: 60 }), words: WORDS }

  it('crosses the floor at 12000 × netChars / floor when past the grace window', () => {
    // 3 full 5-char words + 3 separators = 18 net chars. 12000*18/60 = 3600ms > grace.
    const { log } = typeWords(WORDS, 3)
    const folded = foldLog(ctx, log)._unsafeUnwrap()
    expect(folded.phase).toBe('running')
    expect(netCharsOf(ctx, folded)).toBe(18)
    expect(minSpeedFailInstant(ctx, folded)).toBe(asMs(3600))
  })

  it('respects the grace window (never fails before GRACE_MS)', () => {
    // 1 word + 1 separator = 6 net chars. 12000*6/60 = 1200ms < grace → clamps to grace.
    const { log } = typeWords(WORDS, 1)
    const folded = foldLog(ctx, log)._unsafeUnwrap()
    expect(netCharsOf(ctx, folded)).toBe(6)
    expect(minSpeedFailInstant(ctx, folded)).toBe(asMs(MINSPEED_GRACE_MS))
  })

  it('is null when the mod is off', () => {
    const off: CoreContext = { config: core({ minWpm: 0 }), words: WORDS }
    const { log } = typeWords(WORDS, 3)
    expect(minSpeedFailInstant(off, foldLog(off, log)._unsafeUnwrap())).toBeNull()
  })
})

describe('settle surfaces the floor breach at the exact instant', () => {
  const ctx: CoreContext = { config: core({ minWpm: 60 }), words: WORDS }

  it('finishes at the crossing instant, not before, with failReason minSpeed', () => {
    const { log } = typeWords(WORDS, 3)
    const folded = foldLog(ctx, log)._unsafeUnwrap()
    expect(settle(ctx, folded, asMs(3599)).phase).toBe('running')
    const failed = settle(ctx, folded, asMs(3600))
    expect(failed.phase).toBe('finished')
    expect(failed.finishedAt).toBe(asMs(3600))
    expect(failed.failReason).toBe('minSpeed')
  })

  it('property: settle-derived instant (live tick) == batch-derived (foldLog)', () => {
    const { log } = typeWords(WORDS, 3)
    // Live: dispatch the log into a real core, then tick past the derived instant.
    const live = new GameCore({ config: ctx.config, words: WORDS })
    for (const event of log) live.dispatch(event)
    live.tick(asMs(3600))
    expect(live.state.phase).toBe('finished')
    expect(live.state.failReason).toBe('minSpeed')
    // Batch: foldLog + settle to the same derived instant.
    const batch = settle(ctx, foldLog(ctx, log)._unsafeUnwrap(), asMs(3600))
    expect(batch.finishedAt).toBe(live.state.finishedAt)
    expect(batch.failReason).toBe(live.state.failReason)
  })
})

describe('validateLog — MinSpeed layer', () => {
  const SEED = 12345
  const words = generateWords(dict, makeSeedContext(dict, SEED, gen()))._unsafeUnwrap().words
  const snap = { config: core({ minWpm: 60 }), generation: gen() }
  const run = (log: EventLog) =>
    validateLog({
      seed: SEED,
      dictionary: dict,
      dictVersion: dictVersion(dict.words),
      configSnapshot: snap,
      log
    })._unsafeUnwrap()

  it('a run that stops and decays below the floor is valid; duration is the fail instant', () => {
    const { log } = typeWords(words, 3)
    const report = run({ version: EVENT_LOG_VERSION, events: log })
    expect(report.verdict).toBe('valid')
    // netChars 18, floor 60 → fail at 3600ms; validateLog measures duration there.
    expect(report.metrics.durationSec).toBeCloseTo(3.6, 5)
  })

  it('rejects an event landing after the derived fail instant', () => {
    const { log } = typeWords(words, 3)
    const seq = log.length + 1
    // Fail instant is 3600ms; an insert at 4000ms is past it → replay rejects it.
    log.push(insertEvent(seq, 4000, 'z'))
    const report = run({ version: EVENT_LOG_VERSION, events: log })
    expect(report.verdict).toBe('invalid')
  })
})
