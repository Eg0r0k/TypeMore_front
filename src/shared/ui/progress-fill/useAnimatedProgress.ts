import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useMediaQuery } from '@vueuse/core'

import { clamp01 } from '@/shared/lib/helpers/numbers'

/** Easing curve: maps linear time t∈[0,1] to eased t∈[0,1]. Pure and swappable. */
export type Easing = (t: number) => number

/** Default decelerating curve — quick start, gentle settle. */
export const easeOutQuad: Easing = (t) => t * (2 - t)

export interface AnimatedProgressOptions {
  /** Catch-up duration toward the target, ms. Default ~120. */
  duration?: MaybeRefOrGetter<number>
  /** Force an instant set with no interpolation (seek/scrub). Default false. */
  immediate?: MaybeRefOrGetter<boolean>
  /** Easing curve applied to the catch-up. Default easeOutQuad. */
  easing?: Easing
}

/**
 * Drives a fill element toward `value` (0..1) by writing the `--progress-scale`
 * CSS custom property straight onto the DOM node — never through a ref — so the
 * per-frame updates never trip Vue's reactivity 60×/sec. The element is expected
 * to render `transform: scaleX(var(--progress-scale))` with `transform-origin: left`.
 *
 * The rAF loop starts only when there's a real delta and cancels itself the frame
 * it reaches the target; a new `value` retargets from the current painted scale,
 * so there is no jump and no restart-from-zero. Backward jumps, `immediate`, and
 * `prefers-reduced-motion: reduce` land instantly.
 */
export function useAnimatedProgress(
  target: MaybeRefOrGetter<HTMLElement | null>,
  value: MaybeRefOrGetter<number>,
  options: AnimatedProgressOptions = {}
): void {
  const { easing = easeOutQuad } = options
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  let rafId = 0
  let rendered = 0 // last painted scale, 0..1 — the retarget anchor
  let from = 0
  let to = 0
  let startTs = 0
  let durationMs = 0
  let initialized = false

  const paint = (scale: number): void => {
    rendered = scale
    toValue(target)?.style.setProperty('--progress-scale', String(scale))
  }

  const stop = (): void => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  // The rAF timestamp shares performance.now()'s clock; elapsed is derived from it
  // every frame rather than accumulated, so a dropped frame can't drift the tween.
  const tick = (now: number): void => {
    const t = durationMs > 0 ? clamp01((now - startTs) / durationMs) : 1
    paint(from + (to - from) * easing(t))
    if (t >= 1) {
      paint(to)
      stop()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  const seek = (next: number): void => {
    stop()
    paint(next)
  }

  const animateTo = (next: number): void => {
    to = next
    // Retarget an in-flight tween by only moving the goalpost — keep the running
    // rAF and its clock alive so the single loop keeps painting every frame. This
    // is essential when `value` is fed from ANOTHER rAF loop (e.g. the replay
    // clock): a stop()+reschedule here would be cancelled by this very watcher,
    // which Vue flushes in the microtask between the two loops' frame callbacks,
    // starving the tick so the bar never repaints until updates stop.
    if (rafId !== 0) return
    if (next === rendered) return // settled and no delta -> never spin the loop
    from = rendered
    durationMs = Math.max(0, toValue(options.duration) ?? 120)
    startTs = performance.now()
    rafId = requestAnimationFrame(tick)
  }

  watch(
    () => clamp01(toValue(value)),
    (next) => {
      // First paint, explicit `immediate`, reduced-motion, and any backward jump
      // (e.g. a replay scrub) land instantly; only forward deltas interpolate.
      const instant =
        !initialized || toValue(options.immediate) === true || reduced.value || next < rendered
      initialized = true
      if (instant) seek(next)
      else animateTo(next)
    },
    { immediate: true }
  )

  // The immediate watch above runs during setup, before the template ref binds, so
  // its paint() no-ops on the (still null) DOM node. Flush the resolved scale once
  // the element actually exists.
  watch(
    () => toValue(target),
    (node) => {
      if (node) node.style.setProperty('--progress-scale', String(rendered))
    }
  )

  onScopeDispose(stop)
}
