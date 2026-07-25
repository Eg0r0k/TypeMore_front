/**
 * Racing-style ghost carets INSIDE the local field (ghost cars on the track):
 * the Test widget renders one `.game__ghost-caret` (bar + nick label) per
 * entry of the optional `ghosts` prop, anchored to the ghost's word by window
 * slot. A ghost outside the rendered window / past the words array is hidden,
 * and a viewOnly field (an opponent's own replay) never renders ghosts.
 *
 * happy-dom reports all-zero geometry, so these tests assert PRESENCE and
 * visibility semantics — pixel math is covered by the e2e perf gate.
 */
import { type VueWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { reactive } from 'vue'

import { Test, type TestGhostCaret } from '@/widgets/test'
import type { GameSession, GameView } from '@entities/game'
import { type GameState, asMs, asSeq } from '@shared/core'

interface MutableView {
  snapshot: GameState
  words: readonly string[]
  wordIndex: number
  finished: boolean
  blind: boolean
}

function makeView(): GameView & MutableView {
  return reactive<MutableView>({
    snapshot: {
      phase: 'running',
      wordIndex: 0,
      input: ['he'],
      startedAt: asMs(0),
      finishedAt: null,
      lastSeq: asSeq(2),
      failReason: null
    },
    words: ['hello', 'world', 'again'],
    wordIndex: 0,
    finished: false,
    blind: false
  })
}

/** The local field is NOT viewOnly, so its store must satisfy GameSession. */
function makeSession(): GameSession & MutableView {
  const view = makeView()
  return Object.assign(view, {
    insert: () => undefined,
    replace: () => undefined,
    deleteBackward: () => undefined,
    commit: () => undefined
  })
}

interface FieldProps {
  store: GameView
  ghosts?: readonly TestGhostCaret[]
  viewOnly?: boolean
}

// A non-viewOnly field mounts TestInput, which reads the config store — give
// each mount a fresh Pinia (no store state is asserted here).
const mountField = (props: FieldProps) =>
  mount(Test, {
    props: { shadowMode: 'open' as const, ...props },
    global: { plugins: [createPinia()] },
    attachTo: document.body
  })

const shadowOf = (wrapper: VueWrapper): ShadowRoot => {
  const root = (wrapper.find('.game__host').element as HTMLElement).shadowRoot
  expect(root).not.toBeNull()
  return root as ShadowRoot
}

const ghostEls = (root: ShadowRoot) => Array.from(root.querySelectorAll('.game__ghost-caret'))

describe('Test widget — ghost carets (racing opponents in the local field)', () => {
  it('renders one ghost caret per racing ghost, labelled with the nick', async () => {
    const ghosts: TestGhostCaret[] = [
      { id: 'p2', label: 'Neo', wordIndex: 0, charIndex: 1 },
      { id: 'p3', label: 'Morpheus', wordIndex: 1, charIndex: 3 }
    ]
    const wrapper = mountField({ store: makeSession(), ghosts })
    await flushPromises()

    const els = ghostEls(shadowOf(wrapper))
    expect(els).toHaveLength(2)
    const labels = els.map((el) => el.querySelector('.game__ghost-caret-label')?.textContent)
    expect(labels).toEqual(['Neo', 'Morpheus'])

    wrapper.unmount()
  })

  it('hides a ghost outside the rendered window / past the words array', async () => {
    const ghosts: TestGhostCaret[] = [
      { id: 'p2', label: 'Neo', wordIndex: 1, charIndex: 0 },
      // Only 3 words exist — this word is never in the DOM.
      { id: 'p3', label: 'Smith', wordIndex: 250, charIndex: 4 }
    ]
    const wrapper = mountField({ store: makeSession(), ghosts })
    await flushPromises()

    const els = ghostEls(shadowOf(wrapper))
    expect(els).toHaveLength(1)
    expect(els[0]?.querySelector('.game__ghost-caret-label')?.textContent).toBe('Neo')

    wrapper.unmount()
  })

  it('tracks ghost prop updates reactively (a ghost advancing / dropping out)', async () => {
    const wrapper = mountField({
      store: makeSession(),
      ghosts: [
        { id: 'p2', label: 'Neo', wordIndex: 0, charIndex: 0 },
        { id: 'p3', label: 'Smith', wordIndex: 1, charIndex: 0 }
      ] satisfies TestGhostCaret[]
    })
    await flushPromises()
    expect(ghostEls(shadowOf(wrapper))).toHaveLength(2)

    // Smith leaves the race (filtered out upstream); Neo advances a word.
    await wrapper.setProps({
      ghosts: [{ id: 'p2', label: 'Neo', wordIndex: 1, charIndex: 2 }] satisfies TestGhostCaret[]
    })
    await flushPromises()

    const els = ghostEls(shadowOf(wrapper))
    expect(els).toHaveLength(1)
    expect(els[0]?.querySelector('.game__ghost-caret-label')?.textContent).toBe('Neo')

    wrapper.unmount()
  })

  it('never renders ghost carets on a viewOnly field', async () => {
    const wrapper = mountField({
      store: makeView(),
      viewOnly: true,
      ghosts: [{ id: 'p2', label: 'Neo', wordIndex: 0, charIndex: 1 }] satisfies TestGhostCaret[]
    })
    await flushPromises()

    expect(ghostEls(shadowOf(wrapper))).toHaveLength(0)

    wrapper.unmount()
  })

  it('renders no ghost carets when the prop is omitted (solo field unchanged)', async () => {
    const wrapper = mountField({ store: makeSession() })
    await flushPromises()

    expect(ghostEls(shadowOf(wrapper))).toHaveLength(0)

    wrapper.unmount()
  })
})
