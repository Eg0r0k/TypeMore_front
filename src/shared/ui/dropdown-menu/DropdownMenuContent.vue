<script setup lang="ts">
  import type { DropdownMenuContentEmits, DropdownMenuContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<DropdownMenuContentProps & { class?: HTMLAttributes['class'] }>(),
    {
      sideOffset: 4
    }
  )
  const emits = defineEmits<DropdownMenuContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-sub-alt text-text border border-sub transition-tm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=closed]:scale-95 z-[var(--popup-z)] max-h-(--reka-dropdown-menu-content-available-height) min-w-[8rem] origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md p-1.5',
          props.class
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
