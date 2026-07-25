<script setup lang="ts">
  import type { DropdownMenuItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuItem, useForwardProps } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = withDefaults(
    defineProps<
      DropdownMenuItemProps & {
        class?: HTMLAttributes['class']
        inset?: boolean
        variant?: 'default' | 'destructive'
      }
    >(),
    {
      variant: 'default'
    }
  )

  const delegatedProps = reactiveOmit(props, 'inset', 'variant', 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    :class="
      cn(
        `relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sub outline-hidden select-none transition-tm data-[highlighted]:bg-bg data-[highlighted]:text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-error data-[variant=destructive]:data-[highlighted]:bg-error-extra data-[variant=destructive]:data-[highlighted]:text-text [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-sub`,
        props.class
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
