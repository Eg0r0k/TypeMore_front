<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/shared/lib/utils'

  /**
   * shadcn-vue's `input-group`, restyled onto this project's tokens.
   *
   * ONE control, not a field with something parked beside it: the group owns
   * the surface, the radius and the focus ring, and the input inside it is
   * transparent and borderless. That is the whole point — a button next to an
   * input is two boxes, a button INSIDE the group is one.
   *
   * Upstream draws a bordered field on a `background/30` surface; here the
   * filled `sub-alt` surface and the design system's double focus ring
   * (`focus-ring`, applied on the group when the control inside has
   * focus-visible) are what every other input in the app already uses.
   */
  const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="input-group"
    role="group"
    :class="
      cn(
        'group/input-group bg-sub-alt relative flex w-full min-w-0 items-center rounded-md outline-none transition-tm',
        // The control sets the height; a textarea inside is free to grow.
        'has-[>textarea]:h-auto',
        // The addon's side decides which end of the input loses its padding,
        // so the text never runs under the addon and never sits away from it.
        'has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
        'has-[>[data-align=inline-end]]:[&>input]:pr-1.5',
        // Focus belongs to the GROUP: the ring must go round the whole control,
        // not round the transparent input inside it.
        'has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_1.5px_var(--bg-color),0_0_0_3px_var(--text-color)]',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>
