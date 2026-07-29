import { describe, it, expect, vi } from 'vitest'
import { RandomElementFromArray } from '@/shared/lib/helpers/arrays'
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
})
