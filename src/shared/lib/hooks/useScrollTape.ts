import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Tape-mode horizontal scroll: keeps the active word aligned by translating the
 * words container left.
 *
 * Adapted from the original hook, which re-read every word's geometry (and
 * `getComputedStyle`) on every shift — O(words) forced reflow, the flagged hot
 * spot. Here word widths are measured once into a cache and a shift is O(passed
 * words) of arithmetic; the cache is invalidated on resize / font load. Scrolls
 * via `transform`, not margin.
 */
export function useScrollTape(wordsRef: Ref<HTMLElement | null>, activeIndex: Ref<number>) {
  const offsetX = ref(0)
  let widths: number[] = []

  function measure(): void {
    const container = wordsRef.value
    if (!container) return
    const wordEls = container.querySelectorAll<HTMLElement>('.word')
    widths = Array.from(wordEls, (el) => {
      const style = getComputedStyle(el)
      return (
        el.offsetWidth + parseFloat(style.marginLeft || '0') + parseFloat(style.marginRight || '0')
      )
    })
  }

  function update(): void {
    if (!wordsRef.value) return
    if (widths.length === 0) measure()
    let passed = 0
    for (let i = 0; i < activeIndex.value && i < widths.length; i++) passed += widths[i]
    offsetX.value = passed
  }

  function invalidate(): void {
    widths = []
  }

  function reset(): void {
    offsetX.value = 0
    widths = []
  }

  return { offsetX, update, invalidate, reset }
}
