import { describe, expect, it } from 'vitest'

import { TICK_INTERVAL_MS, nextTickDelay } from '@shared/core'

describe('nextTickDelay (ideal grid)', () => {
  it('targets the grid point start + N*interval', () => {
    expect(nextTickDelay(0, 1, 60_000)).toBe(TICK_INTERVAL_MS)
    expect(nextTickDelay(0, 3, 60_000)).toBe(3 * TICK_INTERVAL_MS)
  })

  it('does not let a late tick shift the following ones', () => {
    // Tick 1 fired 200ms late (elapsed 1200); tick 2 still targets 2000.
    expect(nextTickDelay(1200, 2, 60_000)).toBe(2 * TICK_INTERVAL_MS - 1200)
  })

  it('never returns a negative delay when already past the grid point', () => {
    expect(nextTickDelay(5000, 2, 60_000)).toBe(0)
  })

  it('clamps the final tick to the deadline', () => {
    // duration 2500: tick 3 would target 3000, clamped to 2500 -> 500ms away.
    expect(nextTickDelay(2000, 3, 2500)).toBe(500)
  })
})
