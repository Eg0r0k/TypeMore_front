/**
 * Rendering in-flight IME composition (monkeytype's `compositionDisplay:
 * "replace"`, the only mode we ship).
 *
 * The composed text replaces the letters after the caret and is drawn "dead" —
 * visible, correctness-marked when it already matches, but never an error and
 * never part of the word's error underline. Nothing here is state: the composed
 * string never reaches the store, so a field rendering it is still rendering the
 * same `GameView` every ghost and replay renders.
 */
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia } from 'pinia'

import { Test } from '@/widgets/test'
import { TestWord } from '@/features/test/word'
import type { GameSession } from '@entities/game'
import { type GameState, asMs, asSeq } from '@typemore/core'

import { playStep } from './helpers/ime'

const state = (over: Partial<GameState> = {}): GameState => ({
  phase: 'running',
  wordIndex: 0,
  input: [''],
  startedAt: asMs(0),
  finishedAt: null,
  lastSeq: asSeq(1),
  failReason: null,
  ...over
})

const makeSession = (words: readonly string[], snapshot: GameState = state()): GameSession =>
  reactive({
    snapshot,
    words,
    wordIndex: snapshot.wordIndex,
    finished: false,
    blind: false,
    insert: vi.fn(),
    replace: vi.fn(),
    deleteBackward: vi.fn(),
    commit: vi.fn()
  }) as unknown as GameSession

const shadowOf = (wrapper: VueWrapper): ShadowRoot | null =>
  (wrapper.find('.game__host').element as HTMLElement).shadowRoot

const lettersOf = (wrapper: VueWrapper): HTMLElement[] =>
  [...(shadowOf(wrapper)?.querySelectorAll('.word.active .letter') ?? [])] as HTMLElement[]

describe('TestWord — composed letters', () => {
  const mountWord = (props: Record<string, unknown>) =>
    mount(TestWord, { props: { active: true, ...props } })

  it('draws the composed text over the letters after the caret', () => {
    const wrapper = mountWord({ word: '한글', typed: '', composing: '한' })
    const letters = wrapper.findAll('.letter')
    expect(letters[0].text()).toBe('한')
    expect(letters[0].classes()).toContain('letter--dead')
    // The rest of the target is untouched and not dead.
    expect(letters[1].text()).toBe('글')
    expect(letters[1].classes()).not.toContain('letter--dead')
    wrapper.unmount()
  })

  it('marks a composed character correct once it matches the target', () => {
    const match = mountWord({ word: '한글', typed: '', composing: '한' })
    expect(match.findAll('.letter')[0].classes()).toContain('correct')
    match.unmount()

    // A partial syllable does not match yet — dead, but NOT an error.
    const partial = mountWord({ word: '한글', typed: '', composing: 'ㅎ' })
    const first = partial.findAll('.letter')[0]
    expect(first.classes()).toContain('letter--dead')
    expect(first.classes()).not.toContain('incorrect')
    partial.unmount()
  })

  it('never underlines the word as errored while composing', () => {
    // 'ㅎ' against '한' would be an error if it were typed. It is not typed.
    const wrapper = mountWord({ word: '한글', typed: '', composing: 'ㅎ' })
    expect(wrapper.find('.word').classes()).not.toContain('word--error')
    wrapper.unmount()
  })

  it('composes at the caret, after already-typed letters', () => {
    const wrapper = mountWord({ word: 'hello', typed: 'he', composing: 'll' })
    const letters = wrapper.findAll('.letter')
    expect(letters.map((l) => l.text()).join('')).toBe('hello')
    expect(letters[0].classes()).not.toContain('letter--dead')
    expect(letters[1].classes()).not.toContain('letter--dead')
    expect(letters[2].classes()).toContain('letter--dead')
    expect(letters[3].classes()).toContain('letter--dead')
    expect(letters[4].classes()).not.toContain('letter--dead')
    wrapper.unmount()
  })

  it('renders a composition running past the target as dead, not extra', () => {
    const wrapper = mountWord({ word: '한', typed: '', composing: '한글' })
    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(2)
    expect(letters[1].text()).toBe('글')
    expect(letters[1].classes()).toContain('letter--dead')
    // `extra` is red: nothing has been typed, so nothing is over-typed.
    expect(letters[1].classes()).not.toContain('extra')
    wrapper.unmount()
  })

  it('renders nothing dead when no session is open', () => {
    const wrapper = mountWord({ word: 'hello', typed: 'he' })
    expect(wrapper.findAll('.letter--dead')).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('field — the adapter publishes composition to the active word only', () => {
  const mountField = async (words: readonly string[]) => {
    const session = makeSession(words)
    const wrapper = mount(Test, {
      props: { store: session, shadowMode: 'open' as const },
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })
    await flushPromises()
    return { session, wrapper }
  }

  const textareaOf = (wrapper: VueWrapper): HTMLTextAreaElement =>
    wrapper.find('textarea').element as HTMLTextAreaElement

  it('shows composed text in the field while the session runs', async () => {
    const { wrapper } = await mountField(['한글', '입력'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()

    const dead = shadowOf(wrapper)?.querySelectorAll('.letter--dead') ?? []
    expect(dead).toHaveLength(1)
    expect(lettersOf(wrapper)[0].textContent).toBe('한')
    wrapper.unmount()
  })

  it('clears the composed text when the session ends', async () => {
    const { wrapper } = await mountField(['한글', '입력'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()
    playStep(textarea, { kind: 'compositionend', data: '한' })
    await nextTick()

    expect(shadowOf(wrapper)?.querySelectorAll('.letter--dead')).toHaveLength(0)
    wrapper.unmount()
  })

  it('leaves every other word alone — one word re-renders per update', async () => {
    const { wrapper } = await mountField(['한글', '입력', '테스트'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    await nextTick()

    // The perf gate the field is held to elsewhere (code-words.test.ts): a
    // compositionupdate is as frequent as a keystroke, so it must cost no more.
    const counter = globalThis as { __wordUpdates?: number }
    counter.__wordUpdates = 0
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()
    expect(counter.__wordUpdates).toBeLessThanOrEqual(2)
    delete counter.__wordUpdates

    wrapper.unmount()
  })

  it('spells the composed text out under the field', async () => {
    const { wrapper } = await mountField(['한글', '입력'])
    const textarea = textareaOf(wrapper)
    expect(wrapper.find('.game__composition').exists()).toBe(false)

    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: 'ㅎ' })
    await nextTick()

    const panel = wrapper.find('.game__composition')
    expect(panel.text()).toBe('ㅎ')
    // The IME announces its own candidate window; echoing it would double up.
    expect(panel.attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('follows the composition and disappears with it', async () => {
    const { wrapper } = await mountField(['한글', '입력'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: 'ㅎ' })
    await nextTick()
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()
    expect(wrapper.find('.game__composition').text()).toBe('한')

    playStep(textarea, { kind: 'compositionend', data: '한' })
    await nextTick()
    expect(wrapper.find('.game__composition').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the unresolved buffer a pinyin or romaji stage is still in', async () => {
    // The case the readout exists for: at this point the word itself is showing
    // six latin letters over two hanzi, and only the panel is readable.
    const { wrapper } = await mountField(['房子', '窗户'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: 'fangzi' })
    await nextTick()
    expect(wrapper.find('.game__composition').text()).toBe('fangzi')
    wrapper.unmount()
  })

  it('costs no render at all when an update repeats the same text', async () => {
    const { wrapper } = await mountField(['한글', '입력'])
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()

    const counter = globalThis as { __wordUpdates?: number }
    counter.__wordUpdates = 0
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    await nextTick()
    expect(counter.__wordUpdates).toBe(0)
    delete counter.__wordUpdates

    wrapper.unmount()
  })
})
