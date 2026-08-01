/**
 * IME composition in the input adapter.
 *
 * One mechanism, two payoffs: the mobile suggestion bug (Android drives plain
 * latin through composition) and CJK input are the same code path. The
 * sequences live in `fixtures/ime-sequences.ts` — read the provenance note
 * there before treating a row as ground truth.
 *
 * The invariant under test: a composition session dispatches NOTHING while it
 * runs and EXACTLY ONE `replace(..., 'ime')` when it ends, and the hidden
 * textarea — which the browser really does mutate during a session, because
 * `preventDefault()` on `insertCompositionText` is ignored — is empty again
 * afterwards.
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { TestInput } from '@/features/test/input'
import type { GameSession } from '@entities/game'
import { asMs, asSeq, type GameState } from '@typemore/core'

import {
  ANDROID_LATIN_PLAIN,
  ANDROID_SUGGESTION,
  AUTOCORRECT_REPLACEMENT,
  CHINESE_PINYIN,
  COMPOSITION_CANCELLED,
  FIREFOX_STRAY,
  JAPANESE_KANJI,
  KOREAN_SYLLABLE
} from './fixtures/ime-sequences'
import { playSequence, playStep } from './helpers/ime'

const state = (input: string[] = ['']): GameState => ({
  phase: 'running',
  wordIndex: 0,
  input,
  startedAt: asMs(0),
  finishedAt: null,
  lastSeq: asSeq(1),
  failReason: null
})

interface Recorded {
  readonly calls: string[]
}

/**
 * A session that RECORDS calls and applies them to its own buffer, so a test can
 * assert both what was dispatched and what the player ends up with.
 */
const makeSession = (words: string[], typed = ''): GameSession & Recorded => {
  const calls: string[] = []
  const session = reactive({
    calls,
    snapshot: state([typed]),
    words,
    wordIndex: 0,
    finished: false,
    blind: false,
    insert: vi.fn((text: string) => {
      calls.push(`insert:${text}`)
      session.snapshot = state([session.snapshot.input[0] + text])
    }),
    replace: vi.fn((from: number, to: number, text: string, source: string) => {
      calls.push(`replace(${from},${to}):${text}@${source}`)
      const buffer = session.snapshot.input[0]
      session.snapshot = state([buffer.slice(0, from) + text + buffer.slice(to)])
    }),
    deleteBackward: vi.fn(),
    commit: vi.fn(() => calls.push('commit')),
    keyDown: vi.fn(),
    keyUp: vi.fn()
  }) as unknown as GameSession & Recorded
  return session
}

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const mountInput = (session: GameSession) =>
  mount(TestInput, {
    props: { store: session },
    global: { plugins: [pinia] },
    attachTo: document.body
  })

const textareaOf = (wrapper: ReturnType<typeof mountInput>): HTMLTextAreaElement =>
  wrapper.find('textarea').element as HTMLTextAreaElement

/** What the player's buffer holds after the sequence. */
const bufferOf = (session: GameSession): string => session.snapshot.input[0]

describe('composition — a session is one replace at its end', () => {
  it('commits a korean syllable as a single ime replace', () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), KOREAN_SYLLABLE)
    expect(session.calls).toEqual(['replace(0,0):한@ime'])
    expect(bufferOf(session)).toBe('한')
    wrapper.unmount()
  })

  it('dispatches nothing while the session is still running', () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    for (const step of KOREAN_SYLLABLE.steps.slice(0, -1)) playStep(textarea, step)
    // Three updates went by; the log must still be empty.
    expect(session.calls).toEqual([])
    wrapper.unmount()
  })

  it('takes the FINAL candidate, not the romaji it passed through', () => {
    const session = makeSession(['家'])
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), JAPANESE_KANJI)
    expect(session.calls).toEqual(['replace(0,0):家@ime'])
    wrapper.unmount()
  })

  it('takes the chosen hanzi, not the pinyin buffer', () => {
    const session = makeSession(['房子'])
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), CHINESE_PINYIN)
    expect(session.calls).toEqual(['replace(0,0):房子@ime'])
    wrapper.unmount()
  })

  it('composes at the CARET when the word was already partly typed', () => {
    const session = makeSession(['하한'], '하')
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), KOREAN_SYLLABLE)
    expect(session.calls).toEqual(['replace(1,1):한@ime'])
    expect(bufferOf(session)).toBe('하한')
    wrapper.unmount()
  })

  it('logs nothing when the composition is cancelled', () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), COMPOSITION_CANCELLED)
    expect(session.calls).toEqual([])
    expect(bufferOf(session)).toBe('')
    wrapper.unmount()
  })
})

describe('composition — the textarea is a scratch buffer, never state', () => {
  it('is empty again once the session ends', () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    // The browser really does write here during a session — preventDefault on
    // insertCompositionText is ignored — so simulate that and require cleanup.
    textarea.value = '한'
    playSequence(textarea, KOREAN_SYLLABLE)
    expect(textarea.value).toBe('')
    wrapper.unmount()
  })

  it('does NOT cancel insertCompositionText while composing', () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    const events = playSequence(textareaOf(wrapper), KOREAN_SYLLABLE)
    const composing = events.filter(
      (event) => (event as InputEvent).inputType === 'insertCompositionText'
    )
    expect(composing.length).toBeGreaterThan(0)
    for (const event of composing) expect(event.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it("cancels Firefox's stray event, the one with isComposing false", () => {
    const session = makeSession(['한글'])
    const wrapper = mountInput(session)
    const events = playSequence(textareaOf(wrapper), FIREFOX_STRAY)
    const stray = events[events.length - 1]
    expect((stray as InputEvent).isComposing).toBe(false)
    expect(stray.defaultPrevented).toBe(true)
    // And it produced no second replace for a session already committed.
    expect(session.calls).toEqual(['replace(0,0):하@ime'])
    wrapper.unmount()
  })
})

/**
 * THE MOBILE REGRESSION. Before composition was handled, this sequence left the
 * word judged wrong (nothing was ever dispatched), the caret desynced from the
 * DOM, and the suggestion's trailing space sitting in the textarea as an
 * invisible character the player had to backspace away.
 */
describe('android — suggestion tap on plain latin', () => {
  it('types the suggested word and commits on its trailing space', () => {
    const session = makeSession(['hello', 'world'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    textarea.value = 'hel'
    playSequence(textarea, ANDROID_SUGGESTION)
    // The word itself, then the separator — never one replace carrying both.
    expect(session.calls).toEqual(['replace(0,0):hello@ime', 'commit'])
    expect(bufferOf(session)).toBe('hello')
    // No invisible leftovers: the space became a commit, not a character.
    expect(textarea.value).toBe('')
    wrapper.unmount()
  })

  it('leaves a suggestion without a trailing space uncommitted', () => {
    const session = makeSession(['hi', 'there'])
    const wrapper = mountInput(session)
    playSequence(textareaOf(wrapper), ANDROID_LATIN_PLAIN)
    expect(session.calls).toEqual(['replace(0,0):hi@ime'])
    wrapper.unmount()
  })

  it('treats a full-width space from the IME as the separator', () => {
    const session = makeSession(['hello', 'world'])
    const wrapper = mountInput(session)
    playStep(textareaOf(wrapper), { kind: 'compositionstart', data: '' })
    playStep(textareaOf(wrapper), { kind: 'compositionend', data: 'hello　' })
    expect(session.calls).toEqual(['replace(0,0):hello@ime', 'commit'])
    wrapper.unmount()
  })
})

describe('autocorrect outside a composition session', () => {
  it('replaces the whole word buffer with the replacement text', () => {
    const session = makeSession(['hello'], 'helo')
    const wrapper = mountInput(session)
    const events = playSequence(textareaOf(wrapper), AUTOCORRECT_REPLACEMENT)
    expect(session.calls).toEqual(['replace(0,4):hello@ime'])
    expect(bufferOf(session)).toBe('hello')
    // Prevented: we applied it ourselves, the DOM must not also have it.
    expect(events[0].defaultPrevented).toBe(true)
    wrapper.unmount()
  })
})

describe('quick-end — the last word must not hang on an open composition', () => {
  it('closes the session itself once the last word is complete', () => {
    const session = makeSession(['한'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    // No compositionend from the browser yet — the adapter dispatched its own.
    expect(session.calls).toEqual(['replace(0,0):한@ime'])
    wrapper.unmount()
  })

  it('ignores the browser end that follows its own — exactly one replace', () => {
    const session = makeSession(['한'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    playStep(textarea, { kind: 'compositionend', data: '한' })
    expect(session.calls).toEqual(['replace(0,0):한@ime'])
    wrapper.unmount()
  })

  it('does not fire mid-run — only the last word can quick-end', () => {
    const session = makeSession(['한', '글'])
    const wrapper = mountInput(session)
    const textarea = textareaOf(wrapper)
    playStep(textarea, { kind: 'compositionstart', data: '' })
    playStep(textarea, { kind: 'compositionupdate', data: '한' })
    expect(session.calls).toEqual([])
    wrapper.unmount()
  })
})
