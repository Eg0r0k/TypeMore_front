<script setup lang="ts">
  import type { PopoverContentEmits, PopoverContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { PopoverContent, PopoverPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>(),
    {
      align: 'center',
      sideOffset: 4
    }
  )
  const emits = defineEmits<PopoverContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-sub-alt text-text z-[var(--popup-z)] w-72 max-w-(--reka-popover-content-available-width) rounded-md border border-sub p-2 origin-(--reka-popover-content-transform-origin) outline-none focus-ring popup-motion data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
          props.class
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
