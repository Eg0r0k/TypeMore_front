import { describe, it, expect, beforeEach } from 'vitest'
import { useAccuracy } from '@/shared/lib/hooks/useAccuracy'
import { Ref, ComputedRef } from 'vue'

interface Accuracy {
  correct: number
  incorrect: number
}

interface UseAccuracyReturn {
  accuracy: Ref<Readonly<Accuracy>>
  accuracyPercentage: ComputedRef<number>
  incrementAccuracy: (isCorrect: boolean) => void
  resetAccuracy: () => void
}

describe('useAccuracy', () => {
  let accuracy: UseAccuracyReturn

  beforeEach(() => {
    accuracy = useAccuracy()
  })

  it('should initialize with zero values', () => {
    expect(accuracy.accuracy.value).toEqual({
      correct: 0,
      incorrect: 0
    })
  })

  it('should initialize with provided values', () => {
    const initialValues: Accuracy = { correct: 5, incorrect: 2 }
    accuracy = useAccuracy(initialValues)
    expect(accuracy.accuracy.value).toEqual(initialValues)
  })

  it('should increment correct count', () => {
    accuracy.incrementAccuracy(true)
    expect(accuracy.accuracy.value.correct).toBe(1)
    expect(accuracy.accuracy.value.incorrect).toBe(0)
  })

  it('should increment incorrect count', () => {
    accuracy.incrementAccuracy(false)
    expect(accuracy.accuracy.value.correct).toBe(0)
    expect(accuracy.accuracy.value.incorrect).toBe(1)
  })

  it('should calculate accuracy percentage correctly', () => {
    accuracy.incrementAccuracy(true)
    accuracy.incrementAccuracy(true)
    accuracy.incrementAccuracy(false)
    expect(accuracy.accuracyPercentage.value).toBe(66.67)
  })

  it('should reset accuracy counts', () => {
    accuracy.incrementAccuracy(true)
    accuracy.incrementAccuracy(false)
    accuracy.resetAccuracy()
    expect(accuracy.accuracy.value).toEqual({
      correct: 0,
      incorrect: 0
    })
  })
})
