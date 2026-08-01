/**
 * Rendering in-flight IME composition.
 *
 * Two rules, and the second one had to be looked at rather than reasoned about:
 * composed text SUBSTITUTES for the target letters only while the buffer is a
 * single grapheme cluster in the target's own script; otherwise the target
 * stays on screen, marked "dead" to say a session is open, and the buffer is
 * read off the panel under the field.
 *
 * Nothing here is state: the composed string never reaches the store, so a field
 * rendering it is still rendering the same `GameView` every ghost and replay does.
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

  it('draws a single-cluster buffer over the letter after the caret', () => {
    const wrapper = mountWord({ word: '한글', typed: '', composing: '한' })
    const letters = wrapper.findAll('.letter')
    expect(letters[0].text()).toBe('한')
    expect(letters[0].classes()).toContain('letter--dead')
    // The rest of the target is untouched and not dead.
    expect(letters[1].text()).toBe('글')
    expect(letters[1].classes()).not.toContain('letter--dead')
    wrapper.unmount()
  })

  it('counts CLUSTERS, not code points — a thai vowel sign is one character', () => {
    // 'กำ' is two code points. Substituting it would be right; splitting it
    // would put half a character in one cell and mark two letters dead.
    const wrapper = mountWord({ word: 'กำหนด', typed: '', composing: 'กำ' })
    const dead = wrapper.findAll('.letter--dead')
    expect(dead).toHaveLength(1)
    expect(dead[0].text()).toBe('กำ')
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

  it('marks from the caret, after already-typed letters', () => {
    const wrapper = mountWord({ word: 'hello', typed: 'he', composing: 'l' })
    const letters = wrapper.findAll('.letter')
    expect(letters.map((l) => l.text()).join('')).toBe('hello')
    expect(letters[0].classes()).not.toContain('letter--dead')
    expect(letters[1].classes()).not.toContain('letter--dead')
    expect(letters[2].classes()).toContain('letter--dead')
    expect(letters[3].classes()).not.toContain('letter--dead')
    wrapper.unmount()
  })

  it('renders a single-cluster composition past the target as dead, not extra', () => {
    const wrapper = mountWord({ word: '', typed: '', composing: '글' })
    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(1)
    expect(letters[0].text()).toBe('글')
    expect(letters[0].classes()).toContain('letter--dead')
    // `extra` is red: nothing has been typed, so nothing is over-typed.
    expect(letters[0].classes()).not.toContain('extra')
    wrapper.unmount()
  })
})

/**
 * The substitution rule. A hangul syllable assembles inside one cell, so showing
 * it in place reads as watching the letter being written. A romaji or pinyin
 * buffer is several latin letters standing over one or two CJK glyphs — showing
 * THAT in place erases the word the player is aiming at, so the target stays and
 * the buffer is read off the panel instead.
 */
describe('TestWord — substitution only for a one-cluster buffer', () => {
  const mountWord = (props: Record<string, unknown>) =>
    mount(TestWord, { props: { active: true, ...props } })

  it('keeps the target visible under a multi-cluster buffer', () => {
    const wrapper = mountWord({ word: '房子窗户', typed: '', composing: 'fangzi' })
    const letters = wrapper.findAll('.letter')
    // The word still reads as itself.
    expect(letters.map((l) => l.text()).join('')).toBe('房子窗户')
    // The buffer is six clusters over a four-glyph word, so the marking covers
    // the whole word and stops there.
    expect(wrapper.findAll('.letter--dead')).toHaveLength(4)
    wrapper.unmount()
  })

  it('does not spill a multi-cluster tail past the end of the word', () => {
    // 'fangzi' over a two-glyph word would otherwise append a raw 'ngzi'.
    const wrapper = mountWord({ word: '房子', typed: '', composing: 'fangzi' })
    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(2)
    expect(letters.map((l) => l.text()).join('')).toBe('房子')
    wrapper.unmount()
  })

  /**
   * The romaji transition, the one that had to be looked at rather than reasoned
   * about: `i` → `いえ` → `家`. Every stage must leave the word the same width,
   * or the line twitches sideways on the first keystroke of every word.
   */
  it('keeps the target through every romaji stage until the kanji lands', () => {
    const romaji = mountWord({ word: '家', typed: '', composing: 'i' })
    // NOT 'i': one cluster, but latin over a kanji is phonetic input.
    expect(romaji.findAll('.letter')[0].text()).toBe('家')
    expect(romaji.findAll('.letter--dead')).toHaveLength(1)
    romaji.unmount()

    const kana = mountWord({ word: '家', typed: '', composing: 'いえ' })
    expect(kana.findAll('.letter')[0].text()).toBe('家')
    expect(kana.findAll('.letter--dead')).toHaveLength(1)
    kana.unmount()

    const kanji = mountWord({ word: '家', typed: '', composing: '家' })
    expect(kanji.findAll('.letter')[0].text()).toBe('家')
    expect(kanji.findAll('.letter')[0].classes()).toContain('correct')
    kanji.unmount()
  })

  it('does not put a lone pinyin letter into a full-width cell', () => {
    const wrapper = mountWord({ word: '房子', typed: '', composing: 'f' })
    expect(
      wrapper
        .findAll('.letter')
        .map((l) => l.text())
        .join('')
    ).toBe('房子')
    wrapper.unmount()
  })

  it('still substitutes latin over latin — an Android session on english', () => {
    // The guard is about SCRIPT, not about latin being special: composing 'h'
    // over 'h' is the character being written, same as a jamo over a jamo.
    const wrapper = mountWord({ word: 'hello', typed: '', composing: 'h' })
    const first = wrapper.findAll('.letter')[0]
    expect(first.text()).toBe('h')
    expect(first.classes()).toContain('letter--dead')
    expect(first.classes()).toContain('correct')
    wrapper.unmount()
  })

  it('marks the target correct when a multi-cluster buffer already matches it', () => {
    // The chosen candidate is the word itself: two clusters, so no substitution
    // is needed — the letters are already the right ones.
    const wrapper = mountWord({ word: '房子', typed: '', composing: '房子' })
    const letters = wrapper.findAll('.letter')
    expect(letters.map((l) => l.classes())).toEqual([
      expect.arrayContaining(['correct', 'letter--dead']),
      expect.arrayContaining(['correct', 'letter--dead'])
    ])
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
