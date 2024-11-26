import { describe, it, expect, vi } from 'vitest'
import {
  RandomElementFromArray,
  LastElementFromArray,
  shuffle,
  nthElementFromArray,
  isSameArray
} from '@/shared/lib/helpers/arrays'
import { randomIntFromRange } from '@/shared/lib/helpers/numbers'

vi.mock('@/shared/lib/helpers/numbers', () => ({
  randomIntFromRange: vi.fn()
}))

describe('Array Helper Functions', () => {
  describe('RandomElementFromArray', () => {
    it('should throw error for empty array', () => {
      expect(() => RandomElementFromArray([])).toThrow('Array cannot be empty')
    })

    it('should return random element from array', () => {
      vi.mocked(randomIntFromRange).mockReturnValue(1)
      const arr = [1, 2, 3]
      expect(RandomElementFromArray(arr)).toBe(2)
      expect(randomIntFromRange).toHaveBeenCalledWith(0, 2)
    })

    it('should work with array of different types', () => {
      vi.mocked(randomIntFromRange).mockReturnValue(0)
      expect(RandomElementFromArray(['a', 'b', 'c'])).toBe('a')
      expect(RandomElementFromArray([true, false])).toBe(true)
      expect(RandomElementFromArray([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 })
    })
  })

  describe('LastElementFromArray', () => {
    it('should return last element of array', () => {
      expect(LastElementFromArray([1, 2, 3])).toBe(3)
      expect(LastElementFromArray(['a', 'b', 'c'])).toBe('c')
    })

    it('should return undefined for empty array', () => {
      expect(LastElementFromArray([])).toBeUndefined()
    })

    it('should work with array of objects', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      expect(LastElementFromArray(arr)).toEqual({ id: 2 })
    })
  })

  describe('shuffle', () => {
    it('should not modify empty array', () => {
      const arr: number[] = []
      shuffle(arr)
      expect(arr).toEqual([])
    })

    it('should not modify single element array', () => {
      const arr = [1]
      shuffle(arr)
      expect(arr).toEqual([1])
    })

    it('should shuffle array elements', () => {
      vi.mocked(randomIntFromRange).mockReturnValueOnce(0).mockReturnValueOnce(1)
      const arr = [1, 2, 3]
      shuffle(arr)
      expect(randomIntFromRange).toHaveBeenCalledWith(0, 1)
    })
  })

  describe('nthElementFromArray', () => {
    const arr = [1, 2, 3, 4, 5]

    it('should return correct element for positive index', () => {
      expect(nthElementFromArray(arr, 0)).toBe(1)
      expect(nthElementFromArray(arr, 2)).toBe(3)
      expect(nthElementFromArray(arr, 4)).toBe(5)
    })

    it('should return correct element for negative index', () => {
      expect(nthElementFromArray(arr, -1)).toBe(5)
      expect(nthElementFromArray(arr, -3)).toBe(3)
    })

    it('should return undefined for out of bounds index', () => {
      expect(nthElementFromArray(arr, 5)).toBeUndefined()
      expect(nthElementFromArray(arr, -6)).toBeUndefined()
    })
  })

  describe('isSameArray', () => {
    it('should return true for identical arrays', () => {
      expect(isSameArray([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(isSameArray(['a', 'b'], ['a', 'b'])).toBe(true)
      expect(isSameArray([], [])).toBe(true)
    })

    it('should return false for arrays with different lengths', () => {
      expect(isSameArray([1, 2], [1, 2, 3])).toBe(false)
      expect(isSameArray([1], [])).toBe(false)
    })

    it('should return false for arrays with same length but different elements', () => {
      expect(isSameArray([1, 2, 3], [1, 3, 2])).toBe(false)
      expect(isSameArray(['a', 'b'], ['b', 'a'])).toBe(false)
    })

    it('should work with arrays of objects', () => {
      const obj1 = { id: 1 }
      const obj2 = { id: 2 }
      expect(isSameArray([obj1, obj2], [obj1, obj2])).toBe(true)
      expect(isSameArray([obj1, obj2], [obj2, obj1])).toBe(false)
      expect(isSameArray([{ id: 1 }], [{ id: 1 }])).toBe(false)
    })
  })
})
