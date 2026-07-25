<script setup lang="ts">
  import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { X } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import {
    DialogClose,
    DialogContent,
    DialogOverlay,
    DialogPortal,
    useForwardPropsEmits
  } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  defineOptions({
    inheritAttrs: false
  })

  const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<DialogContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-[var(--modal-z)] grid place-items-center overflow-y-auto bg-bg/75 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-125"
    >
      <DialogContent
        :class="
          cn(
            'relative z-[var(--modal-z)] grid w-full max-w-lg my-8 gap-4 border border-sub bg-sub-alt p-6 rounded-md md:w-full',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-125',
            props.class
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointer-down-outside="
          (event) => {
            const originalEvent = event.detail.originalEvent
            const target = originalEvent.target as HTMLElement
            if (
              originalEvent.offsetX > target.clientWidth ||
              originalEvent.offsetY > target.clientHeight
            ) {
              event.preventDefault()
            }
          }
        "
      >
        <slot />

        <DialogClose
          class="text-sub hover:text-text transition-tm focus-ring rounded-md absolute top-4 right-4 p-0.5"
        >
          <X class="w-4 h-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
