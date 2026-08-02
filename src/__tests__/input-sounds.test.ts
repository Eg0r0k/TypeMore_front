/**
 * Input adapter × audio feedback: a correct grapheme clicks, a wrong one plays
 * the error sample — and blind mode NEVER plays the error sample. The sounds
 * are part of the view, and the error sound would leak the very correctness
 * signal blind masks, so under blind every keystroke clicks like a correct one.
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { TestInput } from '@/features/test/input'
import type { GameSession } from '@entities/game'
import { asMs, asSeq, type GameState } from '@typemore/core'

const sounds = vi.hoisted(() => ({
  click: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/shared/lib/hooks/useSounds', () => ({
  useSounds: () => ({
    playRandomClickSound: sounds.click,
    playErrorSound: sounds.error,
    setClickSounds: vi.fn(),
    setErrorSounds: vi.fn(),
    setVolume: vi.fn()
  })
}))

const state = (input: string[] = ['']): GameState => ({
  phase: 'running',
  wordIndex: 0,
  input,
  startedAt: asMs(0),
  finishedAt: null,
  lastSeq: asSeq(1),
  failReason: null
})

const makeSession = (words: string[], blind: boolean): GameSession =>
  reactive({
    snapshot: state(),
    words,
    wordIndex: 0,
    finished: false,
    blind,
    insert: vi.fn(),
    replace: vi.fn(),
    deleteBackward: vi.fn(),
    commit: vi.fn()
  }) as unknown as GameSession

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  sounds.click.mockClear()
  sounds.error.mockClear()
})

const mountInput = (session: GameSession) =>
  mount(TestInput, {
    props: { store: session },
    global: { plugins: [pinia] },
    attachTo: document.body
  })

const type = async (wrapper: ReturnType<typeof mountInput>, data: string): Promise<void> => {
  await wrapper.find('textarea').trigger('beforeinput', { inputType: 'insertText', data })
}

describe('input adapter — keystroke sound feedback', () => {
  it('clicks on a correct grapheme', async () => {
    const wrapper = mountInput(makeSession(['hello'], false))
    await type(wrapper, 'h')
    expect(sounds.click).toHaveBeenCalledTimes(1)
    expect(sounds.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('plays the error sample on a wrong grapheme', async () => {
    const wrapper = mountInput(makeSession(['hello'], false))
    await type(wrapper, 'x')
    expect(sounds.error).toHaveBeenCalledTimes(1)
    expect(sounds.click).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('blind: a wrong grapheme clicks like a correct one — never the error sample', async () => {
    const wrapper = mountInput(makeSession(['hello'], true))
    await type(wrapper, 'x')
    expect(sounds.click).toHaveBeenCalledTimes(1)
    expect(sounds.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
