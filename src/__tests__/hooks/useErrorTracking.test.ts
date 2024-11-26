import { describe, it, expect, beforeEach } from 'vitest'
import {
  useErrorHistory,
  useMissedWords,
  useErrorTracking
} from '@/shared/lib/hooks/useErrorTracking'

describe('Error Tracking Hooks', () => {
  describe('useErrorHistory', () => {
    let errorHistory: ReturnType<typeof useErrorHistory>

    beforeEach(() => {
      errorHistory = useErrorHistory()
    })

    it('should initialize with empty state', () => {
      expect(errorHistory.errorHistory.value).toEqual({
        count: 0,
        words: []
      })
    })

    it('should increment error count', () => {
      errorHistory.incrementKeypressErrors()
      expect(errorHistory.errorHistory.value.count).toBe(1)

      errorHistory.incrementKeypressErrors()
      expect(errorHistory.errorHistory.value.count).toBe(2)
    })

    it('should add new word to history', () => {
      errorHistory.addWordToHistory('test')
      expect(errorHistory.errorHistory.value.words).toContain('test')
    })

    it('should not add duplicate words to history', () => {
      errorHistory.addWordToHistory('test')
      errorHistory.addWordToHistory('test')
      expect(errorHistory.errorHistory.value.words).toEqual(['test'])
      expect(errorHistory.errorHistory.value.words.length).toBe(1)
    })

    it('should reset error history', () => {
      errorHistory.incrementKeypressErrors()
      errorHistory.addWordToHistory('test')
      errorHistory.resetErrorHistory()

      expect(errorHistory.errorHistory.value).toEqual({
        count: 0,
        words: []
      })
    })
  })

  describe('useMissedWords', () => {
    let missedWords: ReturnType<typeof useMissedWords>

    beforeEach(() => {
      missedWords = useMissedWords()
    })

    it('should initialize with empty state', () => {
      expect(missedWords.missedWords.value).toEqual({})
    })

    it('should add new missed word', () => {
      missedWords.pushMissedWord('test')
      expect(missedWords.missedWords.value['test']).toBe(1)
    })

    it('should increment count for existing missed word', () => {
      missedWords.pushMissedWord('test')
      missedWords.pushMissedWord('test')
      expect(missedWords.missedWords.value['test']).toBe(2)
    })

    it('should track multiple words correctly', () => {
      missedWords.pushMissedWord('test1')
      missedWords.pushMissedWord('test2')
      missedWords.pushMissedWord('test1')

      expect(missedWords.missedWords.value).toEqual({
        test1: 2,
        test2: 1
      })
    })

    it('should reset missed words', () => {
      missedWords.pushMissedWord('test')
      missedWords.resetMissedWords()
      expect(missedWords.missedWords.value).toEqual({})
    })
  })

  describe('useErrorTracking', () => {
    let errorTracking: ReturnType<typeof useErrorTracking>

    beforeEach(() => {
      errorTracking = useErrorTracking()
    })

    it('should initialize with empty state', () => {
      expect(errorTracking.errorHistory.value).toEqual({
        count: 0,
        words: []
      })
      expect(errorTracking.missedWords.value).toEqual({})
    })

    it('should track missed word in both histories', () => {
      errorTracking.pushMissedWordWithHistory('test')

      expect(errorTracking.missedWords.value['test']).toBe(1)

      expect(errorTracking.errorHistory.value.words).toContain('test')
    })

    it('should handle multiple missed words correctly', () => {
      errorTracking.pushMissedWordWithHistory('test1')
      errorTracking.pushMissedWordWithHistory('test2')
      errorTracking.pushMissedWordWithHistory('test1')

      expect(errorTracking.missedWords.value).toEqual({
        test1: 2,
        test2: 1
      })

      expect(errorTracking.errorHistory.value.words).toEqual(['test1', 'test2'])
    })

    it('should reset all error tracking state', () => {
      errorTracking.pushMissedWordWithHistory('test')
      errorTracking.incrementKeypressErrors()

      expect(errorTracking.missedWords.value['test']).toBe(1)
      expect(errorTracking.errorHistory.value.words).toContain('test')
      expect(errorTracking.errorHistory.value.count).toBe(1)

      errorTracking.resetAllErrors()

      expect(errorTracking.missedWords.value).toEqual({})
      expect(errorTracking.errorHistory.value).toEqual({
        count: 0,
        words: []
      })
    })

    it('should maintain separate counts for keypress errors and missed words', () => {
      errorTracking.incrementKeypressErrors()
      errorTracking.incrementKeypressErrors()
      errorTracking.pushMissedWordWithHistory('test')

      expect(errorTracking.errorHistory.value.count).toBe(2)
      expect(errorTracking.missedWords.value['test']).toBe(1)
    })

    it('should preserve error history count when adding missed words', () => {
      errorTracking.incrementKeypressErrors()
      errorTracking.pushMissedWordWithHistory('test')

      expect(errorTracking.errorHistory.value.count).toBe(1)
      expect(errorTracking.errorHistory.value.words).toContain('test')
    })
  })
})
