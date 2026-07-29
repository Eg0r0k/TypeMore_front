/**
 * Input adapter × visual-equivalence normalization: the adapter stores the
 * EXPECTED character when the typed one is its variant (events.ts: the log's
 * text is final before an event exists), and typable space variants separate
 * the word exactly like the space key.
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { TestInput } from '@/features/test/input'
import { useConfigStore } from '@/entities/config'
import type { GameSession } from '@entities/game'
import { asMs, asSeq, type GameState } from '@shared/core'

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

const makeSession = (words: string[], typed = ''): GameSession & Recorded => {
  const calls: string[] = []
  return reactive({
    calls,
    snapshot: state([typed]),
    words,
    wordIndex: 0,
    finished: false,
    blind: false,
    insert: vi.fn((text: string) => calls.push(`insert:${text}`)),
    replace: vi.fn(),
    deleteBackward: vi.fn(),
    commit: vi.fn(() => calls.push('commit')),
    keyDown: vi.fn(),
    keyUp: vi.fn()
  }) as unknown as GameSession & Recorded
}

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const mountInput = (session: GameSession, language?: string) => {
  if (language !== undefined) useConfigStore().config.language = language
  return mount(TestInput, {
    props: { store: session },
    global: { plugins: [pinia] },
    attachTo: document.body
  })
}

const type = async (wrapper: ReturnType<typeof mountInput>, data: string): Promise<void> => {
  await wrapper.find('textarea').trigger('beforeinput', { inputType: 'insertText', data })
}

describe('input adapter — visual-equivalence normalization', () => {
  it('stores the expected dash for a plain hyphen, any language', async () => {
    const session = makeSession(['—a'])
    const wrapper = mountInput(session)
    await type(wrapper, '-')
    expect(session.calls).toEqual(['insert:—'])
    wrapper.unmount()
  })

  it('stores ё for е on a russian dictionary', async () => {
    const session = makeSession(['ёж'])
    const wrapper = mountInput(session, 'russian')
    await type(wrapper, 'е')
    expect(session.calls).toEqual(['insert:ё'])
    wrapper.unmount()
  })

  it('does NOT map е to ё outside the russian dictionary', async () => {
    const session = makeSession(['ёж'])
    const wrapper = mountInput(session, 'english')
    await type(wrapper, 'е')
    expect(session.calls).toEqual(['insert:е'])
    wrapper.unmount()
  })

  it('a genuinely wrong grapheme is stored as typed', async () => {
    const session = makeSession(['abc'])
    const wrapper = mountInput(session)
    await type(wrapper, 'x')
    expect(session.calls).toEqual(['insert:x'])
    wrapper.unmount()
  })

  it('normalizes against the CARET position, not the word start', async () => {
    const session = makeSession(['a—b'], 'a')
    const wrapper = mountInput(session)
    await type(wrapper, '-')
    expect(session.calls).toEqual(['insert:—'])
    wrapper.unmount()
  })

  it('an ideographic space separates the word like the space key', async () => {
    const session = makeSession(['abc'], 'abc')
    const wrapper = mountInput(session)
    await type(wrapper, '　')
    expect(session.calls).toEqual(['commit'])
    wrapper.unmount()
  })
})

/**
 * A space INSIDE a target is a character, not a separator.
 *
 * Both target sources produce such words: `generateWords` splits a quote on
 * U+0020 alone, so a U+00A0 stays inside its token (russian quote #1199,
 * `Молодость!<NBSP>-`), and a dictionary token may be multi-word outright
 * (`use strict`). Committing there was untypeable in every mode, and under
 * `nospace` — where a commit is refused outright — it desynced the whole run.
 */
describe('input adapter — a space the target expects', () => {
  const NBSP = ' '

  const pressSpace = async (wrapper: ReturnType<typeof mountInput>): Promise<void> => {
    await wrapper.find('textarea').trigger('keydown', { key: ' ', code: 'Space' })
  }

  it('types the no-break space a quote token expects instead of committing', async () => {
    const session = makeSession([`Молодость!${NBSP}-`], 'Молодость!')
    const wrapper = mountInput(session, 'russian')
    await pressSpace(wrapper)
    expect(session.calls).toEqual([`insert:${NBSP}`])
    wrapper.unmount()
  })

  it('types the plain space a multi-word dictionary token expects', async () => {
    const session = makeSession(['use strict'], 'use')
    const wrapper = mountInput(session)
    await pressSpace(wrapper)
    expect(session.calls).toEqual(['insert: '])
    wrapper.unmount()
  })

  it('still separates at the end of a token', async () => {
    const session = makeSession(['use strict'], 'use strict')
    const wrapper = mountInput(session)
    await pressSpace(wrapper)
    expect(session.calls).toEqual(['commit'])
    wrapper.unmount()
  })

  it('still separates past the end (over-typed extras)', async () => {
    const session = makeSession(['abc'], 'abcxx')
    const wrapper = mountInput(session)
    await pressSpace(wrapper)
    expect(session.calls).toEqual(['commit'])
    wrapper.unmount()
  })

  it('stores the EXPECTED variant when a soft keyboard sends another one', async () => {
    const session = makeSession([`a${NBSP}b`], 'a')
    const wrapper = mountInput(session)
    await type(wrapper, '　')
    expect(session.calls).toEqual([`insert:${NBSP}`])
    wrapper.unmount()
  })
})
