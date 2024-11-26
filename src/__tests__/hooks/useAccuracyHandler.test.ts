import { describe, it, expect, beforeEach } from 'vitest'
import { useAccuracyHandler } from '@/shared/lib/hooks/useAccuracyHandler'

describe('useAccuracyHandler', () => {
  let handler: ReturnType<typeof useAccuracyHandler>

  beforeEach(() => {
    handler = useAccuracyHandler()
  })

  describe('initial state', () => {
    it('should initialize with zero counts', () => {
      expect(handler.characterCounts.value).toEqual({
        correct: 0,
        incorrect: 0,
        extra: 0,
        total: 0,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })
  })

  describe('incrementCharacterCount', () => {
    it('should increment correct character count', () => {
      handler.incrementCharacterCount(true, 0, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 1,
        incorrect: 0,
        extra: 0,
        total: 1,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })

    it('should increment incorrect character count', () => {
      handler.incrementCharacterCount(false, 0, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 0,
        incorrect: 1,
        extra: 0,
        total: 1,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })

    it('should increment extra character count when index exceeds word length', () => {
      handler.incrementCharacterCount(false, 4, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 0,
        incorrect: 0,
        extra: 1,
        total: 1,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })

    it('should increment total count for each character', () => {
      handler.incrementCharacterCount(true, 0, 'test')
      handler.incrementCharacterCount(false, 1, 'test')
      handler.incrementCharacterCount(false, 4, 'test')

      expect(handler.characterCounts.value.total).toBe(3)
    })

    it('should handle multiple character inputs correctly', () => {
      handler.incrementCharacterCount(true, 0, 'test')
      handler.incrementCharacterCount(false, 1, 'test')
      handler.incrementCharacterCount(true, 2, 'test')
      handler.incrementCharacterCount(true, 3, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 3,
        incorrect: 1,
        extra: 0,
        total: 4,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })

    it('should handle extra characters after word end', () => {
      handler.incrementCharacterCount(true, 0, 'test')
      handler.incrementCharacterCount(true, 1, 'test')
      handler.incrementCharacterCount(true, 2, 'test')
      handler.incrementCharacterCount(true, 3, 'test')
      handler.incrementCharacterCount(false, 4, 'test')
      handler.incrementCharacterCount(false, 5, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 4,
        incorrect: 0,
        extra: 2,
        total: 6,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })
  })

  describe('resetCharacterCounts', () => {
    it('should reset all counts to zero', () => {
      handler.incrementCharacterCount(true, 0, 'test')
      handler.incrementCharacterCount(false, 1, 'test')
      handler.incrementCharacterCount(false, 4, 'test')

      handler.resetCharacterCounts()

      expect(handler.characterCounts.value).toEqual({
        correct: 0,
        incorrect: 0,
        extra: 0,
        total: 0,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })

    it('should allow counting to continue after reset', () => {
      handler.incrementCharacterCount(true, 0, 'test')
      handler.incrementCharacterCount(false, 1, 'test')

      handler.resetCharacterCounts()

      handler.incrementCharacterCount(true, 0, 'test')

      expect(handler.characterCounts.value).toEqual({
        correct: 1,
        incorrect: 0,
        extra: 0,
        total: 1,
        correctSpaces: 0,
        incorrectSpaces: 0
      })
    })
  })
})
