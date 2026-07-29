import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  commitEvent,
  errorWords,
  insertEvent,
  wordHistory
} from '@shared/core'

/**
 * `wordHistory` — the per-word derivation behind the results input-history
 * block: target, typed text, committed flag, burst WPM. A pure function of the
 * log, so plain hand-built events pin its behaviour.
 */

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const ctxOf = (words: readonly string[]): CoreContext => ({ config: coreCfg(), words })

describe('wordHistory', () => {
  it('reports target, typed, committed and burst per reached word', () => {
    const ctx = ctxOf(['ab', 'cd', 'ef'])
    // 'ab' typed over 300ms, committed; 'cd' typed as 'cx' over 250ms, committed;
    // 'ef' reached with one keystroke, never committed.
    const events: GameEvent[] = [
      insertEvent(1, 1000, 'a'),
      insertEvent(2, 1300, 'b'),
      commitEvent(3, 1400),
      insertEvent(4, 2000, 'c'),
      insertEvent(5, 2250, 'x'),
      commitEvent(6, 2300),
      insertEvent(7, 3000, 'e')
    ]

    const history = wordHistory(ctx, events)
    expect(history).toHaveLength(3)

    expect(history[0]).toMatchObject({ target: 'ab', typed: 'ab', committed: true })
    // 2 chars over 300ms: 2 / 5 / (300 / 60000) = 80 wpm.
    expect(history[0].burst).toBeCloseTo(80, 5)

    expect(history[1]).toMatchObject({ target: 'cd', typed: 'cx', committed: true })
    // A mistyped word still has a burst: 2 / 5 / (250 / 60000) = 96 wpm.
    expect(history[1].burst).toBeCloseTo(96, 5)

    // In-flight word: reached (has input), not committed; a single keystroke
    // has no window, so its burst is Infinity — not undefined, which means
    // "nothing typed".
    expect(history[2]).toMatchObject({ target: 'ef', typed: 'e', committed: false })
    expect(history[2].burst).toBe(Infinity)
  })

  it('excludes untouched words entirely', () => {
    const ctx = ctxOf(['ab', 'cd', 'ef'])
    const events: GameEvent[] = [
      insertEvent(1, 1000, 'a'),
      insertEvent(2, 1200, 'b'),
      commitEvent(3, 1300)
    ]

    const history = wordHistory(ctx, events)
    expect(history).toHaveLength(1)
    expect(history[0].target).toBe('ab')
  })

  it('agrees with errorWords on which committed words are missed', () => {
    const ctx = ctxOf(['ab', 'cd', 'ef'])
    const events: GameEvent[] = [
      insertEvent(1, 1000, 'a'),
      insertEvent(2, 1200, 'b'),
      commitEvent(3, 1300),
      insertEvent(4, 2000, 'x'),
      commitEvent(5, 2400),
      insertEvent(6, 3000, 'e'),
      insertEvent(7, 3200, 'f'),
      commitEvent(8, 3300)
    ]

    const missed = wordHistory(ctx, events)
      .filter((entry) => entry.committed && entry.typed !== entry.target)
      .map((entry) => entry.target)
    expect(missed).toEqual(errorWords(ctx, events).map((word) => word.expected))
    expect(missed).toEqual(['cd'])
  })

  it('returns an empty history for an empty log', () => {
    expect(wordHistory(ctxOf(['ab']), [])).toEqual([])
  })
})
