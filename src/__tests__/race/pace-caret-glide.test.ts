/**
 * The pace bot's travel time reaching the screen — and reaching NOBODY ELSE.
 *
 * A paced caret knows when its next character is due, so it hands that time
 * over and the browser interpolates the whole way there at constant speed. A
 * RELAYED caret (a multiplayer opponent, the record ghost) knows no such thing:
 * its positions arrive when they arrive, and any duration would be invented. So
 * `glideMs` is opt-in per ghost, and a ghost that omits it keeps the field's
 * default transition exactly as it always was.
 *
 * `pace-caret-motion.test.ts` covers the schedule that produces the number;
 * this is the wiring from that number to the element.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { reactive } from 'vue'

import { Test } from '@/widgets/test'
import type { GameView } from '@entities/game'
import { type TestGhostCaret, useGhostCarets } from '@shared/lib/hooks/useGhostCarets'
import { asMs, asSeq } from '@typemore/core'
import { ref } from 'vue'

const rect = (left: number, top: number): DOMRect =>
  ({
    left,
    top,
    right: left + 18,
    bottom: top + 52,
    width: 18,
    height: 52,
    x: left,
    y: top,
    toJSON: () => ''
  }) as DOMRect

/** One `.word` per entry, each a single measurable `.letter`. */
function containerWith(count: number): HTMLElement {
  const container = document.createElement('div')
  container.getBoundingClientRect = () => rect(0, 0)
  for (let i = 0; i < count; i++) {
    const word = document.createElement('div')
    word.className = 'word'
    const letter = document.createElement('span')
    letter.className = 'letter'
    letter.getBoundingClientRect = () => rect(10 + i * 40, 0)
    word.appendChild(letter)
    container.appendChild(word)
  }
  return container
}

describe('a ghost caret carries a travel time only when it has one', () => {
  it('passes the paced ghost’s glideMs through the measurer', () => {
    const container = ref<HTMLElement | null>(containerWith(2))
    const ghosts = ref<readonly TestGhostCaret[]>([
      { id: 'pace-caret', label: '', wordIndex: 0, charIndex: 0, glideMs: 200 },
      { id: 'peer', label: 'Neo', wordIndex: 1, charIndex: 0 }
    ])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))

    update()

    expect(positions.value.map((p) => p.glideMs)).toEqual([200, undefined])
  })

  it('re-measures when only the travel time changed', () => {
    // The cache is keyed on position; a bot that is re-sent to the SAME
    // character with a new deadline (a speed change, a restart) must not have
    // the stale duration served back to it.
    const container = ref<HTMLElement | null>(containerWith(1))
    const ghosts = ref<readonly TestGhostCaret[]>([
      { id: 'pace-caret', label: '', wordIndex: 0, charIndex: 0, glideMs: 200 }
    ])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))
    update()
    expect(positions.value[0].glideMs).toBe(200)

    ghosts.value = [{ id: 'pace-caret', label: '', wordIndex: 0, charIndex: 0, glideMs: 100 }]
    update()
    expect(positions.value[0].glideMs).toBe(100)
  })
})

describe('the field animates a paced ghost for exactly its travel time', () => {
  const view = (): GameView =>
    reactive({
      snapshot: {
        phase: 'running',
        wordIndex: 0,
        input: [''],
        startedAt: asMs(0),
        finishedAt: null,
        lastSeq: asSeq(0),
        failReason: null
      },
      words: ['alpha', 'bravo'],
      wordIndex: 0,
      finished: false,
      blind: false
    }) as GameView

  const ghostEl = (wrapper: ReturnType<typeof mount>): HTMLElement => {
    const host = wrapper.find('.game__host').element as HTMLElement
    const el = host.shadowRoot?.querySelector<HTMLElement>('.game__ghost-caret')
    if (!el) throw new Error('ghost caret not rendered')
    return el
  }

  it('puts the duration and a linear curve on the paced ghost', async () => {
    const wrapper = mount(Test, {
      props: {
        store: view(),
        shadowMode: 'open' as const,
        ghosts: [{ id: 'pace-caret', label: '', wordIndex: 0, charIndex: 0, glideMs: 200 }]
      },
      // Ghosts render on the LOCAL field only (a view-only field draws none),
      // so this is a real input-bearing mount and needs the input adapter's store.
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })
    await flushPromises()

    const style = ghostEl(wrapper).style
    expect(style.getPropertyValue('--tm-ghost-ms')).toBe('200ms')
    // Constant speed: an ease would make each character read as its own hop.
    expect(style.getPropertyValue('--tm-ghost-ease')).toBe('linear')

    wrapper.unmount()
  })

  it('leaves a relayed ghost on the field’s own transition', async () => {
    const wrapper = mount(Test, {
      props: {
        store: view(),
        shadowMode: 'open' as const,
        ghosts: [{ id: 'peer', label: 'Neo', wordIndex: 0, charIndex: 0 }]
      },
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })
    await flushPromises()

    // No override at all — the CSS default (0.12s ease) is what a multiplayer
    // opponent has always had, and this is the test that keeps it that way.
    const style = ghostEl(wrapper).style
    expect(style.getPropertyValue('--tm-ghost-ms')).toBe('')
    expect(style.getPropertyValue('--tm-ghost-ease')).toBe('')

    wrapper.unmount()
  })
})
