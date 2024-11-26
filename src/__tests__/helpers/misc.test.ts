import { logRandomIndex } from '@/shared/lib/helpers/misc'

import { describe, it, expect } from 'vitest'

describe('logRandomIndex', () => {
  it('should return an index within array bounds', () => {
    const arrayLengths = [5, 10, 100, 1000]

    arrayLengths.forEach((len) => {
      const result = logRandomIndex(len)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(len)
      expect(Number.isInteger(result)).toBe(true)
    })
  })

  it('should handle small arrays', () => {
    expect(logRandomIndex(1)).toBe(0)
    const result = logRandomIndex(2)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(2)
  })

  it('should have reasonable distribution', () => {
    const len = 10
    const iterations = 1000
    const counts = new Array(len).fill(0)

    for (let i = 0; i < iterations; i++) {
      const index = logRandomIndex(len)
      counts[index]++
    }

    counts.forEach((count) => {
      expect(count).toBeGreaterThan(0)
    })
  })

  it('should handle edge cases', () => {
    expect(logRandomIndex(1)).toBe(0)

    const result = logRandomIndex(1000000)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(1000000)
    expect(Number.isInteger(result)).toBe(true)
  })
})
