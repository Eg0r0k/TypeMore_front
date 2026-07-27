<script lang="ts" setup>
  import type { HTMLAttributes } from 'vue'
  import { onMounted, useTemplateRef, watch } from 'vue'
  import { cn } from '@/shared/lib/utils'

  /**
   * Full-width run-progress bar pinned to the very top of the viewport. It serves
   * both shapes of run, because both answer the same question — how much of this
   * test is left — and a player should not have to read two different widgets to
   * ask it:
   *
   *  - a TIMED run passes `durationMs` and the bar DRAINS from full to empty;
   *  - a COUNTED run passes `value` (0…1) and the bar FILLS as words are committed.
   *
   * The drain is ONE compositor-driven CSS transition on `transform: scaleX()`
   * (transform-origin: left) — no rAF, no per-frame JS. Transform transitions run
   * off the main thread, so the heavy per-keystroke work (field re-render, sound)
   * can't make the bar stutter — which a main-thread rAF feed always did while
   * typing. The authoritative deadline still lives in the timer worker + GameCore;
   * this bar is pure UI, kicked off once when the run starts.
   *
   * The fill cannot work that way: its progress is DISCRETE (one step per
   * committed word) and unknowable in advance, so each step gets its own short
   * transition — still one composited property, still no per-frame JS.
   *
   * Visibility is toggled with OPACITY, never `display`: a transform transition
   * won't start on an element that was `display:none` the same frame (it has no
   * painted "from" state and snaps straight to the target), so the node stays in
   * the render tree and we just fade it.
   */
  const props = defineProps<{
    /** True while the run is in progress (phase === 'running'). */
    running: boolean
    /** Timed run: total duration in ms — the exact length of the drain transition. */
    durationMs?: number
    /** Counted run: the share completed so far, 0…1. */
    value?: number
    class?: HTMLAttributes['class']
  }>()

  const fill = useTemplateRef<HTMLElement>('fill')

  /** A counted run is the one that was handed a `value`; a timed run gets a duration. */
  const isCounted = (): boolean => props.value !== undefined

  const STEP_MS = 120

  const apply = (transform: string, transition: string): void => {
    const el = fill.value
    if (!el) return
    el.style.transition = transition
    el.style.transform = transform
  }

  // Kick off the single full-length transition: snap to full with no transition,
  // force that state to commit (a synchronous reflow read — NOT rAF), then ease to
  // empty over the whole run. `linear` = constant velocity, like a clock.
  const drain = (): void => {
    const el = fill.value
    if (!el) return
    apply('scaleX(1)', 'none')
    void el.offsetWidth // force reflow so the full state paints before the drain
    apply('scaleX(0)', `transform ${Math.max(0, props.durationMs ?? 0)}ms linear`)
  }

  const step = (): void =>
    apply(`scaleX(${Math.min(1, Math.max(0, props.value ?? 0))})`, `transform ${STEP_MS}ms linear`)

  /** Idle: a timed run waits full (nothing spent), a counted one waits empty (nothing done). */
  const reset = (): void => apply(isCounted() ? 'scaleX(0)' : 'scaleX(1)', 'none')

  const sync = (): void => {
    if (!props.running) {
      reset()
      return
    }
    if (isCounted()) step()
    else drain()
  }

  // `flush: 'post'` so the opacity class is applied before we trigger the drain.
  watch(() => props.running, sync, { flush: 'post' })
  // A counted run advances by re-rendering, not by a timer.
  watch(
    () => props.value,
    () => {
      if (props.running && isCounted()) step()
    },
    { flush: 'post' }
  )
  onMounted(sync)
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
