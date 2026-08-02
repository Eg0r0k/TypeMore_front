<script setup lang="ts">
  import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'
  import DialogOverlay from '@/shared/ui/dialog/DialogOverlay.vue'
  import { sheetVariants, type SheetSide } from '.'

  /**
   * shadcn-vue's `sheet`, restyled onto this project's tokens.
   *
   * A panel anchored to an EDGE of the viewport, not a box in the middle of it.
   * `side="bottom"` is a phone's keyboard tray: full width, hard against the
   * bottom, sliding up from off-screen — which is what a picker on a phone
   * should be, and what a popover floating over the middle of a chat is not.
   *
   * Modal like every other dialog here: focus is trapped, Escape closes, and
   * the page behind goes inert. That is correct for a tray you are actively
   * choosing from.
   */
  defineOptions({ inheritAttrs: false })

  const props = defineProps<
    DialogContentProps & { class?: HTMLAttributes['class']; side?: SheetSide }
  >()
  const emits = defineEmits<DialogContentEmits>()

  const delegated = reactiveOmit(props, 'class', 'side')
  const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="sheet-content"
      :class="cn(sheetVariants({ side: props.side ?? 'bottom' }), props.class)"
      v-bind="{ ...forwarded, ...$attrs }"
    >
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
