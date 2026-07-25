<script setup lang="ts">
  import type { DropdownMenuSubTriggerProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { ChevronRight } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<
    DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class']; inset?: boolean }
  >()

  const delegatedProps = reactiveOmit(props, 'class', 'inset')
  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwardedProps"
    :data-inset="inset ? '' : undefined"
    :class="
      cn(
        `relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sub outline-hidden select-none transition-tm data-[highlighted]:bg-bg data-[highlighted]:text-text data-[state=open]:bg-bg data-[state=open]:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-sub`,
        props.class
      )
    "
  >
    <slot />
    <ChevronRight class="ml-auto size-4" />
  </DropdownMenuSubTrigger>
</template>
