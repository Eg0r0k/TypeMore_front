<script setup lang="ts">
  import type { DropdownMenuSubContentEmits, DropdownMenuSubContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuSubContent, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<DropdownMenuSubContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    v-bind="forwarded"
    :class="
      cn(
        'bg-sub-alt text-text border border-sub transition-tm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=closed]:scale-95 z-[var(--popup-z)] min-w-[8rem] max-w-(--reka-dropdown-menu-content-available-width) origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-md p-1.5',
        props.class
      )
    "
  >
    <slot />
  </DropdownMenuSubContent>
</template>
