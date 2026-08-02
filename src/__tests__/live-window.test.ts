/**
 * The floor under a live speed's denominator.
 *
 * Speed is characters over elapsed time, and at the start of a run that
 * division has nothing to say: the first keystroke lands at `startedAt`
 * exactly, so the window is zero wide. The formula's guard turned that into
 * `0 wpm` — not "no reading yet" but the claim that the player is typing at
 * zero — and the next keystroke divided two characters by 200ms and claimed
 * 117.
 */
import { describe, expect, it } from 'vitest'

import { asMs } from '@typemore/core'
import { LIVE_WINDOW_MS, liveMeasureAt } from '@/shared/lib/helpers/live-window'

const started = asMs(5_000)

describe('liveMeasureAt', () => {
  it('holds the window open for a full second at the start of a run', () => {
    // The very first keystroke: the true window is zero wide.
    expect(liveMeasureAt(started, asMs(5_000))).toBe(5_000 + LIVE_WINDOW_MS)
    expect(liveMeasureAt(started, asMs(5_200))).toBe(5_000 + LIVE_WINDOW_MS)
    expect(liveMeasureAt(started, asMs(5_999))).toBe(5_000 + LIVE_WINDOW_MS)
  })

  it('steps aside the moment the run is genuinely a second old', () => {
    expect(liveMeasureAt(started, asMs(6_000))).toBe(6_000)
    expect(liveMeasureAt(started, asMs(9_400))).toBe(9_400)
  })

  it('has nothing to hold before a run has started', () => {
    expect(liveMeasureAt(null, asMs(5_200))).toBe(5_200)
  })
})
