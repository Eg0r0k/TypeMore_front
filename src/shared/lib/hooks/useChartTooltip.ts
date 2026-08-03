import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'

import { clamp } from '@/shared/lib/helpers/numbers'

/**
 * Anchors a chart's hover tooltip to a point without letting it hang off — or
 * get CRUSHED against — the figure's edge.
 *
 * The crushing is the bug this exists for. A tooltip is absolutely positioned
 * with `left: x` and centred with `translateX(-50%)`, and an absolutely
 * positioned box with no width shrink-to-fits into what is left of its
 * containing block — `containerWidth - left`. Near the right edge that is a few
 * dozen pixels, so the text wrapped into a tall thin column pinned to the wall.
 * The transform runs after layout and gives none of that room back.
 *
 * Two halves fix it, and both are needed:
 *
 *   1. the tooltip must be `width: max-content` (`w-max`), so it lays out at
 *      its natural width instead of squeezing into the gap;
 *   2. `left` must then be clamped by the tooltip's MEASURED half-width, which
 *      is what this returns — a constant guess cannot know how wide today's
 *      content is.
 *
 * Usage: bind `tooltip` as the element ref, `left` as its `left` style.
 */
export function useChartTooltip(
  anchorX: Ref<number> | ComputedRef<number>,
  containerWidth: Ref<number> | ComputedRef<number>,
  margin = 6
): { tooltip: Ref<HTMLElement | null>; left: ComputedRef<number> } {
  const tooltip = ref<HTMLElement | null>(null)
  // BORDER box: the default content box excludes the padding and the border,
  // and a tooltip is mostly padding — measuring the content would clamp it a
  // few pixels short and let it poke out of the figure again.
  const { width } = useElementSize(tooltip, undefined, { box: 'border-box' })

  const left = computed(() => {
    const half = width.value / 2
    const min = half + margin
    const max = containerWidth.value - half - margin
    // A tooltip wider than the figure cannot satisfy both edges; keeping it
    // centred is the least bad answer and never reintroduces the squeeze.
    return max <= min ? containerWidth.value / 2 : clamp(anchorX.value, min, max)
  })

  return { tooltip, left }
}
