<script setup lang="ts">
  import type { DialogOverlayProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DialogOverlay } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="delegatedProps"
    :class="
      cn(
        'fixed inset-0 z-[var(--modal-z)] bg-bg/75',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'duration-125',
        props.class
      )
    "
  >
    <slot />
  </DialogOverlay>
</template>
