<script lang="ts" setup>
  import type { HTMLAttributes } from 'vue'
  import { onMounted, useTemplateRef, watch } from 'vue'
  import { cn } from '@/shared/lib/utils'

  /**
   * Full-width time-remaining bar pinned to the very top of the viewport, shown
   * only for timed runs. It drains from full to empty over the run's duration.
   *
   * The drain is ONE compositor-driven CSS transition on `transform: scaleX()`
   * (transform-origin: left) — no rAF, no per-frame JS. Transform transitions run
   * off the main thread, so the heavy per-keystroke work (field re-render, sound)
   * can't make the bar stutter — which a main-thread rAF feed always did while
   * typing. The authoritative deadline still lives in the timer worker + GameCore;
   * this bar is pure UI, kicked off once when the run starts.
   *
   * Visibility is toggled with OPACITY, never `display`: a transform transition
   * won't start on an element that was `display:none` the same frame (it has no
   * painted "from" state and snaps straight to the target), so the node stays in
   * the render tree and we just fade it.
   */
  const props = defineProps<{
    /** True while a timed run is counting down (phase === 'running'). */
    running: boolean
    /** Total run duration in ms — the exact length of the drain transition. */
    durationMs: number
    class?: HTMLAttributes['class']
  }>()

  const fill = useTemplateRef<HTMLElement>('fill')

  // Kick off the single full-length transition: snap to full with no transition,
  // force that state to commit (a synchronous reflow read — NOT rAF), then ease to
  // empty over the whole run. `linear` = constant velocity, like a clock.
  const drain = (): void => {
    const el = fill.value
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'scaleX(1)'
    void el.offsetWidth // force reflow so the full state paints before the drain
    el.style.transition = `transform ${Math.max(0, props.durationMs)}ms linear`
    el.style.transform = 'scaleX(0)'
  }

  const reset = (): void => {
    const el = fill.value
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'scaleX(1)'
  }

  // `flush: 'post'` so the opacity class is applied before we trigger the drain.
  watch(
    () => props.running,
    (running) => (running ? drain() : reset()),
    { flush: 'post' }
  )
  onMounted(() => (props.running ? drain() : reset()))
</script>

<template>
  <div
    data-slot="time-progress"
    role="presentation"
    :class="
      cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-1 w-full overflow-hidden bg-muted text-primary',
        running ? 'opacity-100' : 'opacity-0',
        props.class
      )
    "
  >
    <div
      ref="fill"
      data-slot="time-progress-indicator"
      class="h-full w-full origin-left bg-current will-change-transform"
    />
  </div>
</template>
