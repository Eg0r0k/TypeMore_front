<script setup lang="ts">
  import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { TooltipContent, TooltipPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(),
    {
      sideOffset: 4
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
          'bg-sub-alt border border-sub text-text z-[var(--popup-z)] w-fit rounded-md px-3 py-2 text-[0.8rem] leading-normal text-balance outline-none transition-tm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=instant-open]:opacity-100 data-[state=delayed-open]:opacity-100',
          props.class
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
