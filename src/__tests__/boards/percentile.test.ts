/**
 * "Top X%" — the pinned row's one piece of arithmetic, checked at the edges
 * where flattery or nonsense would creep in.
 */
import { describe, expect, it } from 'vitest'

import { topPercent } from '@/features/leaderboards'

describe('topPercent', () => {
  it('never flatters rank 1 into Top 0%', () => {
    // 1/1000 = 0.1% — rounded UP, and floored at 1.
    expect(topPercent(1, 1000)).toBe(1)
    expect(topPercent(1, 1)).toBe(100)
    expect(topPercent(1, 2)).toBe(50)
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
