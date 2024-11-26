import {
  getMedian,
  numberWithSpaces,
  randomIntFromRange,
  roundTo2
} from '@/shared/lib/helpers/numbers'
import { describe, it, expect } from 'vitest'

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

describe('roundTo2', () => {
  it('should round numbers to 2 decimal places', () => {
    expect(roundTo2(3.14159)).toBe(3.14)
    expect(roundTo2(2.005)).toBe(2.01)
    expect(roundTo2(2.0)).toBe(2)
  })

  it('should handle negative numbers', () => {
    expect(roundTo2(-3.14159)).toBe(-3.14)
    expect(roundTo2(-2.005)).toBe(-2.01)
  })

  it('should handle zero', () => {
    expect(roundTo2(0)).toBe(0)
  })
})

describe('getMedian', () => {
  it('should calculate median for odd length arrays', () => {
    expect(getMedian([1, 2, 3])).toBe(2)
    expect(getMedian([5, 2, 1, 4, 3])).toBe(3)
  })

  it('should calculate median for even length arrays', () => {
    expect(getMedian([1, 2, 3, 4])).toBe(2.5)
    expect(getMedian([1, 2])).toBe(1.5)
  })

  it('should handle arrays with one element', () => {
    expect(getMedian([1])).toBe(1)
  })

  it('should handle unsorted arrays', () => {
    expect(getMedian([3, 1, 2])).toBe(2)
  })
})

describe('numberWithSpaces', () => {
  it('should format numbers with spaces as thousand separators', () => {
    expect(numberWithSpaces(1000)).toBe('1 000')
    expect(numberWithSpaces(12345)).toBe('12 345')
    expect(numberWithSpaces(1234567)).toBe('1 234 567')
  })

  it('should handle small numbers', () => {
    expect(numberWithSpaces(100)).toBe('100')
    expect(numberWithSpaces(10)).toBe('10')
    expect(numberWithSpaces(1)).toBe('1')
  })

  it('should handle zero', () => {
    expect(numberWithSpaces(0)).toBe('0')
  })
})
