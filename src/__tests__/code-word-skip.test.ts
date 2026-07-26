/**
 * The word-skip at a code newline, and the rule that removes its cause.
 *
 * REPORTED: typing Enter (or Space) at a line ending in a code_css quote made a
 * word disappear; two newlines in a row would not advance at all; and a line
 * scrolled off leaving half of itself behind.
 *
 * ROOT CAUSE, single and upstream of all three: the generator split a quote's
 * text on SPACES only, so a line ending was glued into the middle of a target
 * (`{\n\ttext-align:`). A mid-target newline is not representable — a target is
 * one box, so its tail cannot move to the next visual line — and not typeable:
 * Enter there either separates, throwing the tail away, or does not, leaving the
 * line unbreakable. Monkeytype does not have this problem because it rewrites
 * every line break to "\n " BEFORE splitting (`words-generator.ts`), so a
 * newline always closes its token and the indentation after it opens the next.
 * `words.ts` now does the same.
 *
 * With that rule the word boundaries and the visual lines coincide, which is
 * what makes Enter, Space and the window's line-dropping all agree.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { reactive } from 'vue'
import { createPinia } from 'pinia'

import { TestInput } from '@/features/test/input'
import type { GameSession } from '@entities/game'
import {
  asMs,
  asSeq,
  commitEvent,
  dictVersion,
  foldLog,
  generateWords,
  initialStateOf,
  insertEvent,
  makeSeedContext,
  type CoreConfig,
  type Dictionary,
  type GameEvent,
  type GameState,
  type GenerationConfig
} from '@shared/core'

const CSS_TEXT = 'p.center {\n\ttext-align: center;\n\tcolor: red;\n}\n\np.large {\n\tfont-size: 300%\n;}'

/** The screenshot text's real targets, straight out of the core. */
const CSS_WORDS = ((): readonly string[] => {
  const dict: Dictionary = { name: 'code_css', bcp47: 'en', words: ['unused'] }
  const generation: GenerationConfig = {
    mode: 'quote',
    length: 0,
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false,
    textSource: {
      kind: 'quote',
      quoteId: 'q1',
      quoteHash: dictVersion([CSS_TEXT]),
      text: CSS_TEXT
    }
  }
  return generateWords(dict, makeSeedContext(dict, 1, generation))._unsafeUnwrap().words
})()

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

interface MockSession {
  insert: Mock
  commit: Mock
  deleteBackward: Mock
}

const makeSession = (words: readonly string[], snapshot: GameState): GameSession & MockSession =>
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

const mountInput = (session: GameSession) =>
  mount(TestInput, {
    props: { store: session },
    global: { plugins: [createPinia()] },
    attachTo: document.body
  })

describe('word boundaries coincide with visual lines', () => {
  it('never puts a newline anywhere but the end of a target', () => {
    // The premise every one of the three reports failed on.
    for (const word of CSS_WORDS) {
      if (word.includes('\n')) expect(word).toBe(word.slice(0, -1) + '\n')
    }
    expect(CSS_WORDS.filter((w) => w.includes('\n')).every((w) => w.endsWith('\n'))).toBe(true)
  })

  it('gives the doubled newline its own target, so Space advances past it', () => {
    // "two \n in a row do not move to the next word": the blank line is now a
    // target of its own, committed like any other.
    expect(CSS_WORDS).toContain('\n')
  })

  it('starts an indented line with its own tab target', () => {
    expect(CSS_WORDS.filter((w) => w.startsWith('\t'))).toHaveLength(3)
  })
})

describe('Enter and Space at a line ending', () => {
  it('types the newline, then separates — one target per line ending', () => {
    // Caret on the '\n' of '{\n'.
    const session = makeSession(CSS_WORDS, state({ wordIndex: 1, input: ['p.center', '{'] }))
    const input = mountInput(session)

    input.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(session.insert).toHaveBeenCalledWith('\n')
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })

  it('separates on Enter when the target expects no newline', () => {
    const session = makeSession(['hello', 'world'], state({ wordIndex: 0, input: ['hello'] }))
    const input = mountInput(session)

    input.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(session.insert).not.toHaveBeenCalled()
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })

  it('Space advances exactly one target, so the tab line is typed, not skipped', () => {
    // "Space skips \n AND \t AND the word after": with the targets above, the
    // caret at '{\n' has only the newline left, so Space lands on '\ttext-align:'.
    const session = makeSession(CSS_WORDS, state({ wordIndex: 1, input: ['p.center', '{\n'] }))
    const input = mountInput(session)

    input.get('textarea').trigger('keydown', { key: ' ', code: 'Space' })

    expect(session.commit).toHaveBeenCalledTimes(1)
    expect(CSS_WORDS[2]).toBe('\ttext-align:')

    input.unmount()
  })

  it('types a tab into the target that opens with one', () => {
    const session = makeSession(CSS_WORDS, state({ wordIndex: 2, input: ['p.center', '{\n', ''] }))
    const input = mountInput(session)

    input.get('textarea').trigger('keydown', { key: 'Tab' })

    expect(session.insert).toHaveBeenCalledWith('\t')
    expect(session.commit).not.toHaveBeenCalled()

    input.unmount()
  })

  /**
   * The adapter keeps its own guard: a newline separates only when it ENDS the
   * target. The generator now makes that the only kind there is, so this is
   * defence for a future text source rather than a live path — but it is the
   * difference between a truncated word and a typed one, so it stays pinned.
   */
  it('would not commit a mid-target newline if one ever reached it', () => {
    const session = makeSession(['{\n\ttext-align:'], state({ wordIndex: 0, input: ['{'] }))
    const input = mountInput(session)

    input.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(session.insert).toHaveBeenCalledWith('\n')
    expect(session.commit).not.toHaveBeenCalled()

    input.unmount()
  })
})

describe('the core folds the whole quote to a complete run', () => {
  const config: CoreConfig = {
    mode: 'words',
    durationMs: 0,
    maxExtraChars: 40,
    difficulty: 'normal',
    nospace: false,
    minWpm: 0
  }

  it('types every target in full — nothing skipped, nothing missed', () => {
    const ctx = { config, words: CSS_WORDS }
    const events: GameEvent[] = []
    let n = 0
    let t = 0
    for (const word of CSS_WORDS) {
      for (const char of word) events.push(insertEvent(asSeq(++n), asMs((t += 50)), char))
      events.push(commitEvent(asSeq(++n), asMs((t += 50))))
    }

    const final = foldLog(ctx, events)._unsafeUnwrap()

    expect(final.wordIndex).toBe(CSS_WORDS.length)
    expect(final.input).toEqual([...CSS_WORDS])
    expect(initialStateOf(ctx).wordIndex).toBe(0)
  })
})
