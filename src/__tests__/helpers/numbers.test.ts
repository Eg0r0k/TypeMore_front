import {
  clamp,
  clamp01,
  groupThousands,
  randomIntFromRange,
  THIN_SPACE
} from '@/shared/lib/helpers/numbers'
import { describe, it, expect } from 'vitest'

/**
 * Expectations are BUILT from `THIN_SPACE` rather than pasted as literals: the
 * separator is invisible in source, and a hand-typed plain space here would
 * fail in a way no one can see in the diff.
 */
const group = (...parts: string[]): string => parts.join(THIN_SPACE)

describe('randomIntFromRange', () => {
  it('should return a number within the specified range', () => {
    const min = 1
    const max = 10
    const result = randomIntFromRange(min, max)
    expect(result).toBeGreaterThanOrEqual(min)
    expect(result).toBeLessThanOrEqual(max)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('should handle negative numbers', () => {
    const min = -10
    const max = -1
    const result = randomIntFromRange(min, max)
    expect(result).toBeGreaterThanOrEqual(min)
    expect(result).toBeLessThanOrEqual(max)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('should handle same min and max', () => {
    const number = 5
    const result = randomIntFromRange(number, number)
    expect(result).toBe(number)
  })
})

describe('clamp', () => {
  it('should pass through a value already inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('should pull an out-of-range value to the nearest bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(0, -10, -1)).toBe(-1)
    expect(clamp(-20, -10, -1)).toBe(-10)
  })

  it('should leave NaN alone, as the inlined form did', () => {
    expect(clamp(NaN, 0, 1)).toBeNaN()
  })
})

describe('clamp01', () => {
  it('should constrain a fraction to the unit range', () => {
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(-0.2)).toBe(0)
    expect(clamp01(1.7)).toBe(1)
  })

  it('should keep the exact bounds', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(1)).toBe(1)
  })
})

describe('groupThousands', () => {
  it('should separate groups with U+2009, never a plain space', () => {
    expect(THIN_SPACE.codePointAt(0)).toBe(0x2009)
    expect(groupThousands(1000)).not.toBe('1 000')
    expect(groupThousands(1000)).toBe(group('1', '000'))
  })

  it('should group thousands', () => {
    expect(groupThousands(1000)).toBe(group('1', '000'))
    expect(groupThousands(12345)).toBe(group('12', '345'))
    expect(groupThousands(1234567)).toBe(group('1', '234', '567'))
  })

  it('should handle small numbers', () => {
    expect(groupThousands(100)).toBe('100')
    expect(groupThousands(10)).toBe('10')
    expect(groupThousands(1)).toBe('1')
  })

  it('should handle zero', () => {
    expect(groupThousands(0)).toBe('0')
  })

  it('should handle negative numbers', () => {
    // Built from THIN_SPACE like every other expectation here — these two cases
    // used to paste literals with a hand-typed U+0020, the exact invisible trap
    // this file's header warns about, and failed against the real separator.
    expect(groupThousands(-1234)).toBe(group('-1', '234'))
  })

  it('should round before grouping, never grouping decimals', () => {
    expect(groupThousands(1234.56)).toBe(group('1', '235'))
    expect(groupThousands(999.4)).toBe('999')
  })
})
