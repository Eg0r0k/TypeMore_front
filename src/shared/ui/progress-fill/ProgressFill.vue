<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { useTemplateRef } from 'vue'
  import { cn } from '@/shared/lib/utils'
  import { useAnimatedProgress } from './useAnimatedProgress'

  const props = withDefaults(
    defineProps<{
      /** Target progress, 0..1. Out-of-range values are clamped. */
      value: number
      /** Catch-up duration to the target, ms. ~120 by default. */
      duration?: number
      /** Set instantly without animation (seek/scrub along the timeline). */
      immediate?: boolean
      class?: HTMLAttributes['class']
    }>(),
    { duration: 120, immediate: false }
  )

  const fill = useTemplateRef<HTMLElement>('fill')

  useAnimatedProgress(
    () => fill.value,
    () => props.value,
    {
      duration: () => props.duration,
      immediate: () => props.immediate
    }
  )
</script>

<template>
  <!--
    Presentational by default (role="presentation"); any aria-* passed by the
    consumer falls through via $attrs. Track colour, fill colour, and height are
    all overridable through `class`: bg-* recolours the track, text-* recolours
    the fill (it paints with currentColor), h-* sets the height — no extra props.
  -->
  <div
    data-slot="progress-fill"
    role="presentation"
    :class="
      cn('relative h-1 w-full overflow-hidden rounded-full bg-muted text-primary', props.class)
    "
  >
    <div
      ref="fill"
      data-slot="progress-fill-indicator"
      class="absolute inset-0 origin-left bg-current will-change-transform [transform:scaleX(var(--progress-scale,0))]"
    />
  </div>
</template>
