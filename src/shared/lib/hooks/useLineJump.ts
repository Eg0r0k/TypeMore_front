import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Line-aligned window / recycle for the words view.
 *
 * Evolved from the original offsetTop line-jump detection (kept — the browser's
 * flex-wrap is the line engine) into the review's "window + recycle rows" scheme,
 * so a 10 000-word test never puts 10 000 nodes in the DOM. Instead of a vertical
 * transform, whole scrolled-off top lines are dropped by advancing `start`
 * (the absolute index of the first rendered word). The caller renders the slice
 * `words[start .. active + ahead]` keyed by ABSOLUTE index; dropping a *complete*
 * top line preserves the wrapping of everything below it, so there is no reflow
 * churn and the active line simply scrolls up by one line — a clean line jump.
 *
 * `rebalance()` reads live layout (`offsetTop` of `.word` / `.word.active`), so the
 * caller MUST invoke it AFTER the post-commit render has flushed (await nextTick) —
 * otherwise `.word.active` still marks the previous word and the drop lags a commit.
 * It runs after the active word changes (commit or mid-word wrap) and after layout
 * changes (resize / font load); `reset()` returns to the top on (re)generation.
 */
export function useLineJump(wordsRef: Ref<HTMLElement | null>, keepLine = 1) {
  const start = ref(0)

  function rebalance(): void {
    const container = wordsRef.value
    if (!container) return
    const words = container.querySelectorAll<HTMLElement>('.word')
    const active = container.querySelector<HTMLElement>('.word.active')
    if (!active || words.length === 0) return

    const firstTop = words[0].offsetTop
    const style = getComputedStyle(active)
    const lineStep =
      active.offsetHeight +
      parseFloat(style.marginTop || '0') +
      parseFloat(style.marginBottom || '0')
    if (lineStep <= 0) return

    const activeLine = Math.round((active.offsetTop - firstTop) / lineStep)
    const linesToDrop = activeLine - keepLine
    if (linesToDrop <= 0) return

    // Count the words sitting above the (keepLine)-th rendered line and drop them.
    const cutoff = firstTop + linesToDrop * lineStep - lineStep / 2
    let dropped = 0
    for (const word of words) {
      if (word.offsetTop < cutoff) dropped += 1
      else break
    }
    if (dropped > 0) start.value += dropped
  }

  function reset(): void {
    start.value = 0
  }

  return { start, rebalance, reset }
}
