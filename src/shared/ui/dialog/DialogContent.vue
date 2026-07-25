<script setup lang="ts">
  import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { X } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'
  import DialogOverlay from './DialogOverlay.vue'

  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<
      DialogContentProps & { class?: HTMLAttributes['class']; showCloseButton?: boolean }
    >(),
    {
      showCloseButton: true
    }
  )
  const emits = defineEmits<DialogContentEmits>()

  // `showCloseButton` is ours, not reka's — forwarding it would land a stray
  // `showclosebutton="true"` attribute on the dialog element.
  const delegatedProps = reactiveOmit(props, 'class', 'showCloseButton')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-sub-alt border border-sub fixed top-[50%] left-[50%] z-[var(--modal-z)] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-md p-6 sm:max-w-lg',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-125',
          props.class
        )
      "
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="text-sub hover:text-text transition-tm focus-ring rounded-md absolute top-4 right-4 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <X />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
