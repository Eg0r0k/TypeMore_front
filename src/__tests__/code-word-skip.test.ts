/**
 * The word-skip at a code newline.
 *
 * REAL corpus tokens, not the idealised ones. `generateWords` splits a quote's
 * text on SPACES only, so a code quote's `\n` lands in the MIDDLE of a token and
 * its `\t` is never at the head of one:
 *
 *   "p.center {\n\ttext-align: center;\n\tcolor: red;\n}"
 *     -> ["p.center", "{\n\ttext-align:", "center;\n\tcolor:", "red;\n}"]
 *
 * Measured over the served corpora: css_code 241/376 tokens carry a mid-token
 * `\n`, and ZERO of 1 999 tokens across css_code / code_python /
 * code_javascript begin with `\t`. The existing `code-words.test.ts` fixture
 * (`'1;\n'`, `'\tconsole.log(x)\n'`) is the shape the port was designed against
 * and is not a shape the generator can produce — which is why this survived.
 *
 * Consequence: Enter arrives with the caret on a newline that is NOT the end of
 * the target. Committing there throws the rest of the token away, and the player
 * sees the remainder of the line vanish — the reported "skipped word".
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
  foldLog,
  initialStateOf,
  insertEvent,
  type CoreConfig,
  type GameEvent,
  type GameState
} from '@shared/core'

/** The owner's screenshot text, tokenised exactly as `generateWords` does. */
const CSS_TEXT = 'p.center {\n\ttext-align: center;\n\tcolor: red;\n}\n\np.large {\n\tfont-size: 300%\n;}'
const CSS_WORDS = CSS_TEXT.split(' ').filter((w) => w.length > 0)

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

describe('the corpus really does put \\n mid-token', () => {
  it('splits the screenshot text so no token ends with \\n and none begins with \\t', () => {
    expect(CSS_WORDS).toEqual([
      'p.center',
      '{\n\ttext-align:',
      'center;\n\tcolor:',
      'red;\n}\n\np.large',
      '{\n\tfont-size:',
      '300%\n;}'
    ])
    // The two premises the code-mode port was built on, both false for real data.
    expect(CSS_WORDS.some((w) => w.endsWith('\n'))).toBe(false)
    expect(CSS_WORDS.some((w) => w.startsWith('\t'))).toBe(false)
  })
})

describe('Enter at a mid-token newline must not commit the token', () => {
  it('types the newline and keeps the word active (the skip regression)', async () => {
    // Caret sits on the '\n' of '{\n\ttext-align:' — index 1, mid-token.
    const session = makeSession(CSS_WORDS, state({ wordIndex: 1, input: ['p.center', '{'] }))
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Enter' })

    // The newline is a character of this target, so it is typed...
    expect(session.insert).toHaveBeenCalledWith('\n')
    // ...but it does NOT separate: '\ttext-align:' is still to be typed.
    expect(session.commit).not.toHaveBeenCalled()

    input.unmount()
  })

  it('still separates when the newline IS the last character of the target', async () => {
    // code_python really does produce these (13 of 652 tokens): 'key\n' at the
    // very end of a text. Enter there is a genuine separator.
    const words = ['key\n', 'next']
    const session = makeSession(words, state({ wordIndex: 0, input: ['key'] }))
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(session.insert).toHaveBeenCalledWith('\n')
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })

  it('separates on Enter when the target expects no newline at all', async () => {
    // Enter is still a separator for ordinary prose — unchanged behaviour.
    const session = makeSession(['hello', 'world'], state({ wordIndex: 0, input: ['hello'] }))
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(session.insert).not.toHaveBeenCalled()
    expect(session.commit).toHaveBeenCalledTimes(1)

    input.unmount()
  })

  it('types the tab that follows the mid-token newline into the SAME word', async () => {
    // The owner's exact sequence: Enter then Tab. Both belong to token 1.
    const session = makeSession(CSS_WORDS, state({ wordIndex: 1, input: ['p.center', '{\n'] }))
    const input = mountInput(session)

    await input.get('textarea').trigger('keydown', { key: 'Tab' })

    expect(session.insert).toHaveBeenCalledWith('\t')
    expect(session.commit).not.toHaveBeenCalled()

    input.unmount()
  })
})

describe('the core folds the corrected keystrokes to the same state as a manual log', () => {
  const config: CoreConfig = {
    mode: 'words',
    durationMs: 0,
    maxExtraChars: 40,
    difficulty: 'normal',
    nospace: false,
    minWpm: 0
  }

  /** Type a token's characters one insert per grapheme, then commit. */
  const typeToken = (events: GameEvent[], token: string, seq: { n: number; t: number }): void => {
    for (const char of token) {
      seq.n += 1
      seq.t += 50
      events.push(insertEvent(asSeq(seq.n), asMs(seq.t), char))
    }
    seq.n += 1
    seq.t += 50
    events.push(commitEvent(asSeq(seq.n), asMs(seq.t)))
  }

  it('is bit-identical to a hand-written correct log for the same text', () => {
    const ctx = { config, words: CSS_WORDS }
    const seq = { n: 0, t: 0 }
    const events: GameEvent[] = []
    for (const token of CSS_WORDS) typeToken(events, token, seq)

    const folded = foldLog(ctx, events)
    expect(folded.isOk()).toBe(true)
    const final = folded._unsafeUnwrap()

    // Every token typed in full, one commit each — the newline mid-token is an
    // ordinary character of its word, exactly as the reducer already treats it.
    expect(final.wordIndex).toBe(CSS_WORDS.length)
    expect(final.input).toEqual([...CSS_WORDS])

    // And the reducer's own starting point is unchanged by any of this.
    expect(initialStateOf(ctx).wordIndex).toBe(0)
  })

  it('a log that commits at the mid-token newline loses the rest of the token', () => {
    // This is what the pre-fix adapter produced, shown as a state difference
    // rather than an assertion about the adapter.
    const ctx = { config, words: CSS_WORDS }
    const truncated: GameEvent[] = [
      ...[...'p.center'].map((c, i) => insertEvent(asSeq(i + 1), asMs((i + 1) * 50), c)),
      commitEvent(asSeq(9), asMs(450)),
      insertEvent(asSeq(10), asMs(500), '{'),
      insertEvent(asSeq(11), asMs(550), '\n'),
      commitEvent(asSeq(12), asMs(600))
    ]

    const final = foldLog(ctx, truncated)._unsafeUnwrap()
    expect(final.wordIndex).toBe(2)
    // Token 1 is left with 2 of its 14 characters — the vanished line.
    expect(final.input[1]).toBe('{\n')
    expect(CSS_WORDS[1].length).toBe(14)
  })
})
