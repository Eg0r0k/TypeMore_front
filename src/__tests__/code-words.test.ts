/**
 * Tab / newline support, ported from monkeytype (`test-ui.ts` buildWordHTML +
 * `input/handlers/keydown.ts`): a code or quote word list carries its layout in
 * the words themselves — `\t` for indentation, `\n` on the word that closes a
 * line — and the field renders both as glyphs, breaking the line after the word
 * that owns the newline.
 *
 * The engine is untouched: a tab/newline is an ordinary `insert` of that
 * character, and Enter still separates the word.
 */
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia } from 'pinia'

import { Test } from '@/widgets/test'
import { TestWord } from '@/features/test/word'
import { TestInput } from '@/features/test/input'
import { wordBreaksLine, wordsHaveNewline, wordsHaveTab, type GameSession } from '@entities/game'
import { type GameState, asMs, asSeq } from '@typemore/core'

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

/** `const x = 1;` + newline, then an indented body line. */
const CODE_WORDS = ['const', 'x', '=', '1;\n', '\tconsole.log(x)\n', '}'] as const

interface MockSession {
  insert: Mock
  commit: Mock
  deleteBackward: Mock
}

const makeSession = (
  words: readonly string[],
  snapshot: GameState = state()
): GameSession & MockSession =>
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
  }) as unknown as GameSession & MockSession

const shadowOf = (wrapper: VueWrapper): ShadowRoot | null =>
  (wrapper.find('.game__host').element as HTMLElement).shadowRoot

describe('layout-character predicates', () => {
  it('detect what a word list types and which word ends a line', () => {
    expect(wordsHaveTab(CODE_WORDS)).toBe(true)
    expect(wordsHaveNewline(CODE_WORDS)).toBe(true)
    expect(wordsHaveTab(['hello', 'world'])).toBe(false)
    expect(wordsHaveNewline(['hello', 'world'])).toBe(false)
    expect(wordBreaksLine('1;\n')).toBe(true)
    expect(wordBreaksLine('const')).toBe(false)
  })
})

describe('TestWord glyphs', () => {
  it('draws tab and newline as dimmed glyphs, one letter box each', () => {
    const wrapper = mount(TestWord, {
      props: { word: '\tx\n', typed: '', active: true }
    })

    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(3)
    expect(letters.map((l) => l.text())).toEqual(['→', 'x', '↵'])
    expect(letters[0].classes()).toContain('letter--ws')
    expect(letters[1].classes()).not.toContain('letter--ws')
    expect(letters[2].classes()).toContain('letter--ws')
  })

  it('keeps correctness on a typed newline (a mistyped one is still an error)', () => {
    const right = mount(TestWord, { props: { word: 'a\n', typed: 'a\n', active: true } })
    expect(right.findAll('.letter')[1].classes()).toContain('correct')

    const wrong = mount(TestWord, { props: { word: 'a\n', typed: 'ab', active: true } })
    expect(wrong.findAll('.letter')[1].classes()).toContain('incorrect')
  })
})

describe('field line breaks', () => {
  const mountField = (words: readonly string[], props: Record<string, unknown> = {}) =>
    mount(Test, {
      props: {
        store: makeSession(words),
        viewOnly: true,
        shadowMode: 'open' as const,
        ...props
      },
      attachTo: document.body
    })

  it('emits a breaker after every word that owns a newline, and never a .word', async () => {
    const wrapper = mountField(CODE_WORDS)
    await flushPromises()

    const root = shadowOf(wrapper)
    // The breaker must not join the `.word` sequence: useLineJump, useScrollTape
    // and useGhostCarets all index those nodes by window slot.
    expect(root?.querySelectorAll('.word')).toHaveLength(CODE_WORDS.length)
    expect(root?.querySelectorAll('.line-break')).toHaveLength(2)

    const children = Array.from(root?.querySelector('.game__words')?.children ?? [])
    const breakIndex = children.findIndex((el) => el.classList.contains('line-break'))
    expect(children[breakIndex - 1]?.textContent).toContain('1;')

    wrapper.unmount()
  })

  it('renders no breakers for a plain word list', async () => {
    const wrapper = mountField(['hello', 'world'])
    await flushPromises()

    expect(shadowOf(wrapper)?.querySelectorAll('.line-break')).toHaveLength(0)

    wrapper.unmount()
  })

  it('suppresses breakers in tape mode (a single nowrap row)', async () => {
    const wrapper = mountField(CODE_WORDS, { tape: true })
    await flushPromises()

    expect(shadowOf(wrapper)?.querySelectorAll('.line-break')).toHaveLength(0)

    wrapper.unmount()
  })

  it('keeps the words memoized (one re-render for the word that changed)', async () => {
    const session = makeSession(CODE_WORDS)
    const wrapper = mount(Test, {
      props: { store: session, viewOnly: true, shadowMode: 'open' as const },
      attachTo: document.body
    })
    await flushPromises()

    const counter = globalThis as { __wordUpdates?: number }
    counter.__wordUpdates = 0
    session.snapshot = state({ input: ['c'] })
    await nextTick()
    expect(counter.__wordUpdates).toBeLessThanOrEqual(2)
    delete counter.__wordUpdates

    wrapper.unmount()
  })
})

describe('input adapter: Tab and Enter', () => {
  const mountInput = (session: GameSession) =>
    mount(TestInput, {
      props: { store: session },
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })

  it('types a tab when the run has tabs, and leaves Tab alone when it has none', async () => {
    const code = makeSession(CODE_WORDS)
    const codeInput = mountInput(code)
    await codeInput.get('textarea').trigger('keydown', { key: 'Tab' })
    expect(code.insert).toHaveBeenCalledWith('\t')

    const plain = makeSession(['hello'])
    const plainInput = mountInput(plain)
    await plainInput.get('textarea').trigger('keydown', { key: 'Tab' })
    expect(plain.insert).not.toHaveBeenCalled()

    codeInput.unmount()
    plainInput.unmount()
  })

  it('leaves Shift+Tab to the browser so the page stays navigable', async () => {
    const code = makeSession(CODE_WORDS)
    const input = mountInput(code)

    await input.get('textarea').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(code.insert).not.toHaveBeenCalled()

    input.unmount()
  })

  it('types the newline before separating when the target expects one', async () => {
    // Caret sits on the '\n' of '1;\n'.
    const session = makeSession(
      CODE_WORDS,
      state({ wordIndex: 3, input: ['const', 'x', '=', '1;'] })
    )
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(session.insert).toHaveBeenCalledWith('\n')
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })

  it('keeps Enter a plain separator when the target has no newline there', async () => {
    const session = makeSession(['hello'], state({ input: ['hel'] }))
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(session.insert).not.toHaveBeenCalled()
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })
})
