/**
 * Ghost caret PLACEMENT: the words viewport clips (`overflow: hidden`), so a
 * nick label that does not fit above the bar (first rendered line) or to its
 * right (right edge) must flip instead of being cut off by the frame.
 *
 * happy-dom reports all-zero geometry, so every rect here is stubbed: the point
 * under test is the decision, not the browser's layout engine.
 */
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  GHOST_LABEL_HEIGHT,
  GHOST_LABEL_MAX_WIDTH,
  type TestGhostCaret,
  useGhostCarets
} from '@shared/lib/hooks/useGhostCarets'

const LINE_HEIGHT = 52
const CONTAINER_WIDTH = 600

const rect = (box: { left: number; top: number; width: number; height: number }): DOMRect =>
  ({
    left: box.left,
    top: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    width: box.width,
    height: box.height,
    x: box.left,
    y: box.top,
    toJSON: () => ''
  }) as DOMRect

/**
 * A words container holding one `.word` per entry, each a single `.letter` at
 * the given position — enough for the hook's insertion-point math.
 */
function containerWith(words: readonly { left: number; top: number }[]): HTMLElement {
  const container = document.createElement('div')
  container.getBoundingClientRect = () =>
    rect({ left: 0, top: 0, width: CONTAINER_WIDTH, height: 156 })
  for (const spot of words) {
    const word = document.createElement('div')
    word.className = 'word'
    const letter = document.createElement('span')
    letter.className = 'letter'
    letter.getBoundingClientRect = () =>
      rect({ left: spot.left, top: spot.top, width: 18, height: LINE_HEIGHT })
    word.appendChild(letter)
    container.appendChild(word)
  }
  return container
}

const ghost = (wordIndex: number): TestGhostCaret => ({
  id: `g${wordIndex}`,
  label: 'Neo',
  wordIndex,
  charIndex: 0
})

describe('useGhostCarets — label placement inside the clipped viewport', () => {
  it('flips the nick below the bar on the first rendered line, keeps it above elsewhere', () => {
    const container = ref<HTMLElement | null>(
      containerWith([
        { left: 10, top: 0 }, // first line: nothing above it but the frame
        { left: 10, top: LINE_HEIGHT } // second line: room above
      ])
    )
    const ghosts = ref<readonly TestGhostCaret[]>([ghost(0), ghost(1)])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))

    update()

    expect(positions.value.map((p) => p.labelBelow)).toEqual([true, false])
  })

  it('treats "fits above" as the label\'s own height, not a bare zero check', () => {
    // A caret one pixel short of the label's height still has nowhere to put it.
    const container = ref<HTMLElement | null>(
      containerWith([
        { left: 10, top: GHOST_LABEL_HEIGHT - 1 },
        { left: 10, top: GHOST_LABEL_HEIGHT }
      ])
    )
    const ghosts = ref<readonly TestGhostCaret[]>([ghost(0), ghost(1)])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))

    update()

    expect(positions.value.map((p) => p.labelBelow)).toEqual([true, false])
  })

  it('grows the nick leftwards only when it would overflow the right edge', () => {
    const container = ref<HTMLElement | null>(
      containerWith([
        { left: 10, top: LINE_HEIGHT }, // far from the edge
        { left: CONTAINER_WIDTH - GHOST_LABEL_MAX_WIDTH + 1, top: LINE_HEIGHT } // one px too far right
      ])
    )
    const ghosts = ref<readonly TestGhostCaret[]>([ghost(0), ghost(1)])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))

    update()

    expect(positions.value.map((p) => p.labelLeft)).toEqual([false, true])
  })

  it('keeps the flags on the cached path (no re-measure, same answer)', () => {
    const container = ref<HTMLElement | null>(containerWith([{ left: 10, top: 0 }]))
    const ghosts = ref<readonly TestGhostCaret[]>([ghost(0)])
    const { positions, update } = useGhostCarets(container, ghosts, ref(0))

    update()
    const first = positions.value[0]
    // Second pass with unchanged (wordIndex, charIndex, windowStart): the hook
    // serves the cache — the flags must survive that path too.
    update()

    expect(positions.value[0]).toEqual(first)
    expect(positions.value[0].labelBelow).toBe(true)
  })
})
