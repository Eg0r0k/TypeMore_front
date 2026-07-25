<script setup lang="ts">
  import type { VariantProps } from 'class-variance-authority'
  import type { ToggleGroupItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ToggleGroupItem, useForwardProps } from 'reka-ui'
  import { inject } from 'vue'
  import { cn } from '@/shared/lib/utils'
  import type { toggleVariants } from '@/shared/ui/toggle'

  type ToggleGroupVariants = VariantProps<typeof toggleVariants> & {
    spacing?: number
  }

  const props = defineProps<
    ToggleGroupItemProps & {
      class?: HTMLAttributes['class']
      variant?: ToggleGroupVariants['variant']
      size?: ToggleGroupVariants['size']
    }
  >()

  const context = inject<ToggleGroupVariants>('toggleGroup')

  const delegatedProps = reactiveOmit(props, 'class', 'size', 'variant')
  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <ToggleGroupItem
    v-slot="slotProps"
    data-slot="toggle-group-item"
    :data-variant="context?.variant || variant"
    :data-size="context?.size || size"
    :data-spacing="context?.spacing"
    v-bind="forwardedProps"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm font-medium outline-none',
        'bg-transparent text-sub hover:text-text',
        'data-[state=on]:bg-main data-[state=on]:text-bg',
        'transition-tm focus-ring focus:z-10 focus-visible:z-10',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        props.class
      )
    "
  >
    <slot v-bind="slotProps" />
  </ToggleGroupItem>
</template>
