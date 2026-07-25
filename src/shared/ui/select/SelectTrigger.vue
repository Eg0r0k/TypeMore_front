<script setup lang="ts">
  import type { SelectTriggerProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { ChevronDown } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = withDefaults(
    defineProps<
      SelectTriggerProps & { class?: HTMLAttributes['class']; size?: 'sm' | 'default' }
    >(),
    { size: 'default' }
  )

  const delegatedProps = reactiveOmit(props, 'class', 'size')
  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    v-bind="forwardedProps"
    :class="
      cn(
        `group flex w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-sub bg-sub-alt px-3 py-2 text-sm text-text outline-none transition-tm focus-ring data-[placeholder]:text-sub disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
        props.class
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 text-sub transition-tm group-data-[state=open]:rotate-180" />
    </SelectIcon>
  </SelectTrigger>
</template>
