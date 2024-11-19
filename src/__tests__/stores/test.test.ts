import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useInputStore } from '@/entities/input/model'
import { useReplayStore } from '@/entities/replay/model/store'
import { useTestStateStore } from '@/entities/test'

describe('TestStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('should correctly initialize store values', () => {
    const testStateStore = useTestStateStore()
    expect(testStateStore.isActive).toBe(false)
    expect(testStateStore.isRepeated).toBe(false)
    expect(testStateStore.isLoading).toBe(true)
    expect(testStateStore.currentWordElementIndex).toBe(0)
    expect(testStateStore.currentTestLine).toBe(0)
  })

  it('should set active state', () => {
    const testStateStore = useTestStateStore()
    testStateStore.setActive(true)
    expect(testStateStore.isActive).toBe(true)
    testStateStore.setActive(false)
    expect(testStateStore.isActive).toBe(false)
  })

  it('should set repeated state', () => {
    const testStateStore = useTestStateStore()
    testStateStore.setRepeated(true)
    expect(testStateStore.isRepeated).toBe(true)
    testStateStore.setRepeated(false)
    expect(testStateStore.isRepeated).toBe(false)
  })

  it('should set loading state', () => {
    const testStateStore = useTestStateStore()
    testStateStore.setLoading(false)
    expect(testStateStore.isLoading).toBe(false)
    testStateStore.setLoading(true)
    expect(testStateStore.isLoading).toBe(true)
  })

  it('should reset current word index', () => {
    const testStateStore = useTestStateStore()
    testStateStore.setCurrentWordElementIndex(5)
    testStateStore.reset()
    expect(testStateStore.currentWordElementIndex).toBe(0)
  })

  it('should set current word index', () => {
    const testStateStore = useTestStateStore()
    testStateStore.setCurrentWordElementIndex(10)
    expect(testStateStore.currentWordElementIndex).toBe(10)
  })

  it('should increment and decrement word index', () => {
    const testStateStore = useTestStateStore()
    testStateStore.incrementWordIndex()
    expect(testStateStore.currentWordElementIndex).toBe(1)
    testStateStore.decrementWordIndex()
    expect(testStateStore.currentWordElementIndex).toBe(0)
  })

  it('should finish the test and call replayStore', async () => {
    const testStateStore = useTestStateStore()
    const inputStore = useInputStore()
    const replayStore = useReplayStore()

    inputStore.input.history = ['word1', 'word2']

    const replaySpy = vi.spyOn(replayStore, 'replayGetWordsList')

    testStateStore.setActive(true)
    expect(testStateStore.isActive).toBe(true)

    await testStateStore.finish()

    expect(testStateStore.isActive).toBe(false)
    expect(replaySpy).toHaveBeenCalledOnce()
    expect(replaySpy).toHaveBeenCalledWith(inputStore.input.history)
  })

  it('should not finish if already inactive', async () => {
    const testStateStore = useTestStateStore()
    const replayStore = useReplayStore()
    const replaySpy = vi.spyOn(replayStore, 'replayGetWordsList')

    testStateStore.setActive(false)
    await testStateStore.finish()
    expect(replaySpy).not.toHaveBeenCalled()
  })
})
