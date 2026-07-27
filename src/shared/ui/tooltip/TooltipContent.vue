<script setup lang="ts">
  import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  /**
   * Tooltip body, shaped after monkeytype's (balloon.css): a small tight box with
   * an arrow at the element it describes, appearing with a short fade and a
   * nudge away from that element.
   *
   * Their `--balloon-color` is a near-black that sits DARKER than the page; we
   * have no such token, so the raised surface (`sub-alt`) carries the box instead
   * — same job, one of our four colours, and legible on every published theme.
   * The radius follows theirs too: `calc(roundness / 2)`, which is `rounded-sm`
   * against our `--border-radius`.
   */
  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(),
    {
      sideOffset: 6
    }
  )

  const emits = defineEmits<TooltipContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')
  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'bg-sub-alt text-text z-[var(--popup-z)] w-fit rounded-sm px-3 py-1.5 text-sm leading-normal text-balance outline-none',
          'animate-in fade-in-0 duration-100',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
          props.class
        )
      "
    >
      <slot />
      <!-- Rotated square rather than a border triangle: it inherits the box's
           own colour, so a theme switch cannot leave the arrow behind. -->
      <TooltipArrow as-child>
        <div class="bg-sub-alt size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px]" />
      </TooltipArrow>
    </TooltipContent>
  </TooltipPortal>
</template>
