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
 * Measured geometry is cached by a `${caretIndex}:${activeSignature}` key; the
 * cache is invalidated on line jump, resize, and `document.fonts.ready` (via
 * `invalidate()`), and the active word is re-measured whenever the caret index
 * changes, so extra characters that widen the word stay tracked. Coordinates are
 * relative to the words container, so they remain correct under any container
 * transform (tape mode).
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

    if (letters.length === 0) {
      const rect = active.getBoundingClientRect()
      x.value = rect.left - base.left
      y.value = rect.top - base.top
      height.value = rect.height
      width.value = rect.width
    } else if (idx < letters.length) {
      const rect = letters[idx].getBoundingClientRect()
      x.value = rect.left - base.left
      y.value = rect.top - base.top
      height.value = rect.height
      width.value = rect.width
    } else {
      // Caret past the typed word: anchor on the last letter's right edge and
      // borrow its width — the cell the next character would occupy.
      const rect = letters[letters.length - 1].getBoundingClientRect()
      x.value = rect.right - base.left
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
