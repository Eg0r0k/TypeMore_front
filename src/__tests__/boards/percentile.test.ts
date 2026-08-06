/**
 * "Top X%" — the pinned row's one piece of arithmetic, checked at the edges
 * where flattery or nonsense would creep in.
 */
import { describe, expect, it } from 'vitest'

import { topPercent } from '@/features/leaderboards'

describe('topPercent', () => {
  it('goes finer than a whole percent at the top, and still never says Top 0%', () => {
    // The whole-percent floor used to tell rank 1 of 10 000 "Top 1%"; the
    // honest figure is two decimal places, floored at 0.01.
    expect(topPercent(1, 1000)).toBe(0.1)
    expect(topPercent(1, 10_000)).toBe(0.01)
    expect(topPercent(1, 1_000_000)).toBe(0.01)
    expect(topPercent(1, 1)).toBe(100)
    expect(topPercent(1, 2)).toBe(50)
  })

  it('rounds the fine steps UP too, so precision never flatters', () => {
    // 1/999 ≈ 0.1001% → 0.2, not 0.1; 3/2000 = 0.15% → exact one decimal? no:
    // 0.15 has no one-decimal form, so 0.2. 1/150 ≈ 0.667% → 0.7.
    expect(topPercent(1, 999)).toBe(0.2)
    expect(topPercent(3, 2000)).toBe(0.2)
    expect(topPercent(1, 150)).toBe(0.7)
    // The 1% boundary stays whole: 1/100 is exactly Top 1%.
    expect(topPercent(1, 100)).toBe(1)
  })

  it('puts the last place at exactly Top 100%', () => {
    expect(topPercent(50, 50)).toBe(100)
    expect(topPercent(999, 1000)).toBe(100)
  })

  it('rounds UP, so a claim is never better than the truth', () => {
    // 7/50 = 14 exactly; 8/50 = 16; 3/7 ≈ 42.86 → 43.
    expect(topPercent(7, 50)).toBe(14)
    expect(topPercent(8, 50)).toBe(16)
    expect(topPercent(3, 7)).toBe(43)
  })

  it('clamps a rank beyond a stale count to 100 rather than claiming 104%', () => {
    // The catalogue count and /me are read at different instants.
    expect(topPercent(52, 50)).toBe(100)
  })

  it('answers nothing without an honest denominator', () => {
    expect(topPercent(7, undefined)).toBeNull()
    expect(topPercent(7, 0)).toBeNull()
    expect(topPercent(0, 50)).toBeNull()
  })
})
