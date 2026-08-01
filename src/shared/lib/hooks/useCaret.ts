import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Caret geometry for the words view.
 *
 * Positions the caret at the current insertion point of the active word and
 * exposes it as a transform (x, y) plus the measured letter box (width, height).
 * The width is what the block/outline/underline caret styles are drawn from — a
 * caret "one character wide" is exactly the letter it sits on. It finds the
 * active word by the `.word.active` marker rather than an index, so it is
 * agnostic to the windowed (recycled) render — the active word is always within
 * the rendered slice.
 *
 * DIRECTION-AWARE. The caret marks the point the NEXT character lands on, and in
 * RTL text that point is the letter's RIGHT edge, not its left — the reading
 * order is mirrored, so anchoring on `left` put the caret one whole cell past
 * where the next glyph would appear, and running off the end of a word sent it
 * to the wrong side of the word entirely. Direction is read off the active word
 * itself (`getComputedStyle`) rather than passed in: it is whatever CSS actually
 * resolved, which is the same thing the browser laid the letters out with, and
 * it keeps working if a single word ever gets a direction of its own.
 *
 * Measured geometry is cached by a `${caretIndex}:${activeSignature}` key; the
 * cache is invalidated on line jump, resize, font size/family change, and
 * `document.fonts.ready` (via `invalidate()`), and the active word is re-measured
 * whenever the caret index changes, so extra characters that widen the word stay
 * tracked. Coordinates are relative to the words container, so they remain
 * correct under any container transform (tape mode).
 *
 * The cache key deliberately does NOT include the type metrics: a font change
 * moves every letter without touching the caret index or the word's text, so
 * nothing in the key could see it. The caller invalidates instead — which it has
 * to do regardless, because a change nothing re-measures is a change nothing
 * notices.
 */
export function useCaret(wordsRef: Ref<HTMLElement | null>, caretIndex: Ref<number>) {
  const x = ref(0)
  const y = ref(0)
  const height = ref(0)
  const width = ref(0)
  const visible = ref(false)
  let cacheKey = ''

  function update(): void {
    const container = wordsRef.value
    if (!container) {
      visible.value = false
      return
    }
    const active = container.querySelector<HTMLElement>('.word.active')
    if (!active) {
      visible.value = false
      return
    }
    // Signature ties the cache to the active word's identity + caret position.
    const key = `${caretIndex.value}:${active.textContent ?? ''}`
    if (key === cacheKey && visible.value) return

    const base = container.getBoundingClientRect()
    const letters = active.querySelectorAll<HTMLElement>('.letter')
    const idx = caretIndex.value
    const rtl = getComputedStyle(active).direction === 'rtl'

    // The caret is drawn from `x` leftwards-or-rightwards by `width` depending on
    // the style, so `x` is always the LEADING edge of the cell the next character
    // will occupy: the cell's left edge in LTR, its right edge in RTL.
    const leading = (rect: DOMRect): number => (rtl ? rect.right : rect.left) - base.left
    const trailing = (rect: DOMRect): number => (rtl ? rect.left : rect.right) - base.left

    if (letters.length === 0) {
      const rect = active.getBoundingClientRect()
      x.value = leading(rect)
      y.value = rect.top - base.top
      height.value = rect.height
      width.value = rect.width
    } else if (idx < letters.length) {
      const rect = letters[idx].getBoundingClientRect()
      x.value = leading(rect)
      y.value = rect.top - base.top
      height.value = rect.height
      width.value = rect.width
    } else {
      // Caret past the typed word: anchor on the last letter's trailing edge and
      // borrow its width — the cell the next character would occupy. In RTL that
      // trailing edge is the letter's LEFT side, because the word grows leftward.
      const rect = letters[letters.length - 1].getBoundingClientRect()
      x.value = trailing(rect)
      y.value = rect.top - base.top
      height.value = rect.height
      width.value = rect.width
    }

    cacheKey = key
    visible.value = true
  }

  function invalidate(): void {
    cacheKey = ''
  }

  return { x, y, width, height, visible, update, invalidate }
}
