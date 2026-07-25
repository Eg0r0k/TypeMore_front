import type { Ref } from 'vue'
import { ref } from 'vue'

/** One racing-style opponent caret rendered inside the local words field. */
export interface TestGhostCaret {
  /** Stable identity (playerId) — keys the DOM element and the measure cache. */
  id: string
  /** Short label rendered above the bar (nick; CSS-truncated to ~8ch). */
  label: string
  /** Absolute index of the ghost's active word. */
  wordIndex: number
  /** Caret position inside that word (typed length). */
  charIndex: number
}

/**
 * The nick label's own box, in px. Exported because BOTH the shadow CSS
 * (`widgets/test/game-styles.ts`, which sizes the label) and the placement math
 * below (which decides whether the label fits) must agree on it: the label is
 * absolutely positioned outside the 2px bar, so nothing in layout would catch a
 * drift between the two.
 */
export const GHOST_LABEL_HEIGHT = 13
export const GHOST_LABEL_MAX_WIDTH = 56

/** A measured, renderable ghost caret (coordinates relative to the words container). */
export interface GhostCaretPosition {
  id: string
  label: string
  x: number
  y: number
  height: number
  /**
   * Put the nick UNDER the bar: the caret sits on the first rendered line, so a
   * label above it would be cut off by the viewport frame (the words viewport is
   * `overflow: hidden`, and the bar starts at y = 0 there).
   */
  labelBelow: boolean
  /** Grow the nick LEFTWARDS: the caret is close enough to the right edge that a left-anchored label would be clipped. */
  labelLeft: boolean
}

interface GhostCacheEntry {
  wordIndex: number
  charIndex: number
  /** Window start the slot was resolved against — a window shift moves every word. */
  start: number
  visible: boolean
  x: number
  y: number
  height: number
  labelBelow: boolean
  labelLeft: boolean
}

/**
 * Ghost (opponent) caret geometry for the words view — the multi-caret sibling
 * of `useCaret`, sharing its measuring math but NOT its `.word.active` anchor:
 * a ghost's word is found by window slot (`wordIndex - windowStart`), so a
 * ghost outside the rendered window (or past the words array — those words are
 * simply not in the DOM) is hidden rather than clamped.
 *
 * Cost model: `update()` re-measures ONLY ghosts whose (wordIndex, charIndex,
 * windowStart) changed since the last pass — the per-ghost cache makes ghost
 * prop churn (relay batches) cheap, and the local keystroke path never calls
 * this at all. `invalidate()` drops the cache for true geometry changes
 * (line jump / resize / fonts / words reset).
 */
export function useGhostCarets(
  wordsRef: Ref<HTMLElement | null>,
  ghostsRef: Ref<readonly TestGhostCaret[]>,
  windowStart: Ref<number>
) {
  const positions = ref<GhostCaretPosition[]>([])
  const cache = new Map<string, GhostCacheEntry>()

  function update(): void {
    const container = wordsRef.value
    const ghosts = ghostsRef.value
    if (!container || ghosts.length === 0) {
      cache.clear()
      if (positions.value.length > 0) positions.value = []
      return
    }

    const start = windowStart.value
    // Lazily read layout only if some ghost actually needs a re-measure.
    let base: DOMRect | null = null
    let wordNodes: NodeListOf<HTMLElement> | null = null
    const next: GhostCaretPosition[] = []
    const liveIds = new Set<string>()

    for (const ghost of ghosts) {
      liveIds.add(ghost.id)
      const cached = cache.get(ghost.id)
      if (
        cached !== undefined &&
        cached.wordIndex === ghost.wordIndex &&
        cached.charIndex === ghost.charIndex &&
        cached.start === start
      ) {
        if (cached.visible) {
          next.push({
            id: ghost.id,
            label: ghost.label,
            x: cached.x,
            y: cached.y,
            height: cached.height,
            labelBelow: cached.labelBelow,
            labelLeft: cached.labelLeft
          })
        }
        continue
      }

      base ??= container.getBoundingClientRect()
      wordNodes ??= container.querySelectorAll<HTMLElement>('.word')

      const slot = ghost.wordIndex - start
      const word = slot >= 0 ? wordNodes[slot] : undefined
      if (word === undefined) {
        // Outside the rendered window or past the words array: hidden.
        cache.set(ghost.id, {
          wordIndex: ghost.wordIndex,
          charIndex: ghost.charIndex,
          start,
          visible: false,
          x: 0,
          y: 0,
          height: 0,
          labelBelow: false,
          labelLeft: false
        })
        continue
      }

      // Same insertion-point math as useCaret: letter left edge, or the last
      // letter's right edge when the caret sits past the typed word.
      const letters = word.querySelectorAll<HTMLElement>('.letter')
      const idx = ghost.charIndex
      let x: number
      let y: number
      let height: number
      if (letters.length === 0) {
        const rect = word.getBoundingClientRect()
        x = rect.left - base.left
        y = rect.top - base.top
        height = rect.height
      } else if (idx < letters.length) {
        const rect = letters[idx].getBoundingClientRect()
        x = rect.left - base.left
        y = rect.top - base.top
        height = rect.height
      } else {
        const rect = letters[letters.length - 1].getBoundingClientRect()
        x = rect.right - base.left
        y = rect.top - base.top
        height = rect.height
      }

      // Placement: the words viewport clips (`overflow: hidden`), so a label
      // that does not fit on the natural side is flipped to the other one
      // rather than cut off. Both sides are decided from the SAME measurement —
      // no extra layout read, and the flags ride the cache with the position.
      const labelBelow = y < GHOST_LABEL_HEIGHT
      const labelLeft = x + GHOST_LABEL_MAX_WIDTH > base.width

      cache.set(ghost.id, {
        wordIndex: ghost.wordIndex,
        charIndex: ghost.charIndex,
        start,
        visible: true,
        x,
        y,
        height,
        labelBelow,
        labelLeft
      })
      next.push({ id: ghost.id, label: ghost.label, x, y, height, labelBelow, labelLeft })
    }

    // Drop cache entries for ghosts that left (finished / disconnected peers).
    for (const id of cache.keys()) {
      if (!liveIds.has(id)) cache.delete(id)
    }

    positions.value = next
  }

  function invalidate(): void {
    cache.clear()
  }

  return { positions, update, invalidate }
}
